import { readFileSync } from "node:fs";
import { getRuntimeConfig } from "@/lib/config/runtime";
import {
	isProviderEnabled,
	isProviderSeedingEnabled,
} from "@/lib/config/schema";
import { logger } from "@/lib/logging/logger";
import type { TorrentSearchProvider } from "@/lib/search/provider";
import { providers } from "@/lib/search/provider-registry";
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

function normalizeTorrentName(name: string) {
	return name.trim().toLocaleLowerCase();
}

async function checkProviderSeedRequirements(provider: TorrentSearchProvider) {
	let requiredNames: Set<string>;
	try {
		requiredNames = new Set(
			(await provider.getSeedRequirements())
				.map(normalizeTorrentName)
				.filter((name) => name.length > 0),
		);
	} catch (error) {
		logger.error(error);
		return;
	}
	if (!shouldCheckSeedRequirements(provider)) return;

	const now = Date.now();
	const torrents = getTorrentClient().torrents.filter((torrent) => {
		const data = getTorrentData(torrent);
		const seedRecord = seedRecords[torrent.infoHash];
		return (
			data?.provider === provider.id &&
			Boolean(data.seed) &&
			seedRecord !== undefined &&
			now - seedRecord.addedAt >= seedRequirementGracePeriod &&
			data.streams.size === 0 &&
			!requiredNames.has(normalizeTorrentName(torrent.name))
		);
	});

	await Promise.all(
		torrents.map(async (torrent) => {
			logger.debug(
				`Tracker no longer requires seeding, removing torrent: ${torrent.name} (${torrent.infoHash})`,
			);
			await destroyTorrentInternal(torrent);
		}),
	);
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
