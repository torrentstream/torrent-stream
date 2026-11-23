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
	decideSeedRemoval,
	normalizeRequiredNames,
	seedRequirementCheckInterval,
} from "./seed-requirements";
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

async function checkProviderSeedRequirements(provider: TorrentSearchProvider) {
	let requiredNames: string[];
	try {
		requiredNames = normalizeRequiredNames(
			await provider.getSeedRequirements(),
		);
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

		const { remove, unrequiredSince } = decideSeedRemoval(
			{
				name: torrent.name,
				addedAt: seedRecord.addedAt,
				streaming: data.streams.size > 0,
				unrequiredSince: data.unrequiredSince,
			},
			requiredNames,
			now,
		);
		data.unrequiredSince = unrequiredSince;
		if (remove) removable.push(torrent);
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
