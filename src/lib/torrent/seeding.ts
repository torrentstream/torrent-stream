import { readFileSync } from "node:fs";
import type { Torrent } from "webtorrent";
import { getRuntimeConfig } from "@/lib/config/runtime";
import {
	isProviderEnabled,
	isProviderSeedingEnabled,
} from "@/lib/config/schema";
import { logger } from "@/lib/logging/logger";
import type { TorrentSearchProvider } from "@/lib/search/provider";
import { providers } from "@/lib/search/provider-registry";
import {
	recordSeedCheck,
	recordSeedCheckFailure,
} from "@/lib/search/provider-status";
import { getTorrentClient } from "./clients";
import {
	dropSeedRecord,
	flushSeedRecords,
	metainfoFile,
	seedRecords,
} from "./persistence";
import {
	destroyTorrentInternal,
	getTorrentData,
	isSeedingEnabled,
	registerTorrent,
	schedulePause,
} from "./streams";

declare global {
	var seedRequirementInterval: NodeJS.Timeout | undefined;
}

const seedRequirementCheckInterval = 60 * 60 * 1000;
const seedRequirementGracePeriod = 8 * 60 * 60 * 1000;
// Checks also run on every configuration change, so the confirming check must
// be a later scheduled one rather than simply the next one.
const seedRequirementConfirmationDelay = seedRequirementCheckInterval / 2;

// Tracker pages truncate long titles, so a name that is a prefix of the other
// counts as the same torrent once it is long enough to be distinctive.
const minimumPrefixMatchLength = 12;

function normalizeTorrentName(name: string) {
	return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function isSameTorrentName(a: string, b: string) {
	if (a === b) return true;
	const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
	return (
		shorter.length >= minimumPrefixMatchLength && longer.startsWith(shorter)
	);
}

async function checkProviderSeedRequirements(provider: TorrentSearchProvider) {
	let requiredNames: string[];
	try {
		requiredNames = [
			...new Set(
				(await provider.getSeedRequirements())
					.map(normalizeTorrentName)
					.filter((name) => name.length > 0),
			),
		];
	} catch (error) {
		logger.error(error);
		recordSeedCheckFailure(provider.id, error);
		return;
	}
	if (!shouldCheckSeedRequirements(provider)) return;

	// An empty list is a real answer: providers throw when the page they got
	// is not the tracker's list (layout change, maintenance page, bot
	// challenge), and removal still needs a second, confirming check.

	const now = Date.now();
	const removable: Torrent[] = [];
	for (const torrent of getTorrentClient().torrents) {
		const data = getTorrentData(torrent);
		const seedRecord = seedRecords[torrent.infoHash];
		if (data?.provider !== provider.id || !data.seed || !seedRecord) continue;

		const name = normalizeTorrentName(torrent.name);
		const unrequired =
			now - seedRecord.addedAt >= seedRequirementGracePeriod &&
			data.streams.size === 0 &&
			!requiredNames.some((required) => isSameTorrentName(required, name));
		if (!unrequired) {
			data.unrequiredSince = undefined;
			continue;
		}
		// Removal needs a second check to confirm that the torrent is still not
		// listed, in case the tracker served an incomplete page.
		data.unrequiredSince ??= now;
		if (now - data.unrequiredSince >= seedRequirementConfirmationDelay) {
			removable.push(torrent);
		}
	}

	await Promise.all(
		removable.map(async (torrent) => {
			logger.debug(
				`Tracker no longer requires seeding, removing torrent: ${torrent.name} (${torrent.infoHash})`,
			);
			await destroyTorrentInternal(torrent);
		}),
	);
	recordSeedCheck(provider.id, {
		outcome: "checked",
		required: requiredNames.length,
		removed: removable.length,
	});
}

function shouldCheckSeedRequirements(provider: TorrentSearchProvider) {
	const config = getRuntimeConfig().config;
	return (
		config.storage.mode === "file" &&
		isProviderEnabled(config, provider.id) &&
		isProviderSeedingEnabled(config, provider.id)
	);
}

async function checkSeedRequirements() {
	const enabledProviders = providers.filter(shouldCheckSeedRequirements);
	await Promise.all(
		enabledProviders.map((provider) => checkProviderSeedRequirements(provider)),
	);
}

function stopSeedRequirementInterval() {
	clearInterval(global.seedRequirementInterval);
	global.seedRequirementInterval = undefined;
}

function startSeedRequirementInterval() {
	stopSeedRequirementInterval();
	if (getRuntimeConfig().config.storage.mode !== "file") return;
	global.seedRequirementInterval = setInterval(() => {
		void checkSeedRequirements();
	}, seedRequirementCheckInterval);
}

export async function resumeSeedingTorrents() {
	stopSeedRequirementInterval();
	if (getRuntimeConfig().config.storage.mode !== "file") return;

	const torrentClient = getTorrentClient();
	const resumed: Promise<void>[] = [];
	for (const infoHash of Object.keys(seedRecords)) {
		const record = seedRecords[infoHash];
		if (!isSeedingEnabled(record.provider)) continue;
		if (await torrentClient.get(infoHash)) continue;

		let metainfo: Buffer;
		try {
			metainfo = readFileSync(metainfoFile(infoHash));
		} catch {
			logger.warn(`Missing metainfo, dropping seed record: ${infoHash}`);
			dropSeedRecord(infoHash);
			continue;
		}

		resumed.push(
			new Promise((resolve) => {
				let timeout: NodeJS.Timeout;
				const done = () => {
					clearTimeout(timeout);
					resolve();
				};
				timeout = setTimeout(
					done,
					getRuntimeConfig().config.torrent.addTimeout,
				);
				const torrent = torrentClient.add(
					metainfo,
					{
						path: getRuntimeConfig().config.storage.path,
						destroyStoreOnDestroy: true,
						deselect: true,
					},
					(torrent) => {
						registerTorrent(torrent, record.provider);
						schedulePause(torrent);
						logger.info(
							`Seeding resumed: ${torrent.name} (${torrent.infoHash})`,
						);
						done();
					},
				);
				torrent.once("error", () => {
					logger.warn(`Resume failed, preserving seed record: ${infoHash}`);
					done();
				});
			}),
		);
	}

	await Promise.all(resumed);
	await checkSeedRequirements();
	startSeedRequirementInterval();
	flushSeedRecords(true);
}
