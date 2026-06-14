import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Torrent, TorrentFile } from "webtorrent";
import { config, TorrentStorageMode } from "@/lib/config";
import { logger } from "@/lib/logger";
import { LRU } from "@/lib/lru";
import { torrentClient } from "./clients";
import { TorrentStreamChunkStore } from "./store";

interface TorrentData {
	streams: Map<string, TorrentStream>;
	speeds: LRU<number, { date: Date; upload: number; download: number }>;
	timeout?: NodeJS.Timeout;
	seed?: SeedState;
	streamedFiles: Set<string>;
}

interface SeedState {
	uploadedBase: number;
	downloadedBase: number;
	uploadedOffset: number;
	downloadedOffset: number;
	seedSeconds: number;
}

interface SeedRecord {
	name: string;
	size: number;
	uploaded: number;
	downloaded: number;
	seedSeconds: number;
	addedAt: string;
	files: string[];
}

declare global {
	var torrentDataMap: Map<Torrent, TorrentData> | undefined;
	var seedRecordsMap: Record<string, SeedRecord> | undefined;
}

const seedTimeEnabled =
	config.torrentSeedTime > 0 ||
	(config.torrentSeedTimeIncrement > 0 &&
		config.torrentSeedTimeIncrementBytes > 0);

const seedingEnabled =
	config.torrentStorageMode === TorrentStorageMode.File &&
	(config.torrentSeedRatio > 0 || seedTimeEnabled);

const stateFile = join(config.torrentStatePath, "torrents.json");

let seedRecordsDirty = false;
let lastSeedFlush = 0;

function metainfoFile(infoHash: string) {
	return join(config.torrentStatePath, `${infoHash}.torrent`);
}

function loadSeedRecords(): Record<string, SeedRecord> {
	if (!existsSync(stateFile)) return {};
	try {
		const parsed = JSON.parse(readFileSync(stateFile, "utf8"));
		if (typeof parsed !== "object" || parsed === null) {
			throw new Error("Seed state is not an object");
		}
		return parsed;
	} catch (error) {
		logger.error(error);
		logger.warn(`Seed state is corrupted, starting fresh: ${stateFile}`);
		try {
			renameSync(stateFile, `${stateFile}.bak`);
		} catch (renameError) {
			logger.error(renameError);
		}
		return {};
	}
}

function flushSeedRecords(force = false) {
	if (!seedRecordsDirty) return;
	if (!force && Date.now() - lastSeedFlush < 15 * 1000) return;
	lastSeedFlush = Date.now();
	try {
		mkdirSync(config.torrentStatePath, { recursive: true });
		writeFileSync(`${stateFile}.tmp`, JSON.stringify(seedRecords, null, "\t"));
		renameSync(`${stateFile}.tmp`, stateFile);
		seedRecordsDirty = false;
	} catch (error) {
		logger.error(error);
	}
}

if (!global.torrentDataMap) {
	const map = new Map<Torrent, TorrentData>();

	global.torrentDataMap = map;
	global.seedRecordsMap = seedingEnabled ? loadSeedRecords() : {};

	setInterval(() => {
		torrentClient.torrents.forEach((torrent) => {
			const data = map.get(torrent);
			if (!data) return;
			const now = new Date();
			data.speeds.put(now.getTime(), {
				date: now,
				download: torrent.downloadSpeed,
				upload: torrent.uploadSpeed,
			});
			updateSeedRecord(torrent, data);
		});
		flushSeedRecords();
	}, 1000);

	if (seedingEnabled) {
		const shutdown = () => {
			flushSeedRecords(true);
			process.exit(0);
		};
		process.once("SIGTERM", shutdown);
		process.once("SIGINT", shutdown);
	} else if (config.torrentSeedRatio > 0 || seedTimeEnabled) {
		logger.warn("Seed requirements are ignored in memory storage mode");
	}
}

const torrentData = global.torrentDataMap;
const seedRecords = global.seedRecordsMap ?? {};

export class TorrentStream {
	id: string;
	torrent: Torrent;
	files = new Map<string, TorrentFile>();
	timeout?: NodeJS.Timeout;

	constructor(id: string, torrent: Torrent) {
		this.id = id;
		this.torrent = torrent;
	}

	refreshTimeout() {
		clearTimeout(this.timeout);
		this.timeout = setTimeout(() => {
			unregisterStream(this.id, this.torrent);
		}, config.torrentIdleTimeout);
	}
}

function seedTotals(torrent: Torrent, seed: SeedState) {
	return {
		uploaded:
			seed.uploadedBase + Math.max(0, torrent.uploaded - seed.uploadedOffset),
		downloaded:
			seed.downloadedBase +
			Math.max(0, torrent.downloaded - seed.downloadedOffset),
	};
}

function updateSeedRecord(torrent: Torrent, data: TorrentData) {
	if (!data.seed) return;
	data.seed.seedSeconds++;
	const record = seedRecords[torrent.infoHash];
	if (!record) return;
	const { uploaded, downloaded } = seedTotals(torrent, data.seed);
	record.uploaded = uploaded;
	record.downloaded = downloaded;
	record.seedSeconds = data.seed.seedSeconds;
	seedRecordsDirty = true;
}

function initSeedState(torrent: Torrent): SeedState {
	let record = seedRecords[torrent.infoHash];
	if (!record) {
		record = {
			name: torrent.name,
			size: torrent.length,
			uploaded: 0,
			downloaded: 0,
			seedSeconds: 0,
			addedAt: new Date().toISOString(),
			files: [],
		};
		seedRecords[torrent.infoHash] = record;
		seedRecordsDirty = true;
	}
	try {
		mkdirSync(config.torrentStatePath, { recursive: true });
		if (!existsSync(metainfoFile(torrent.infoHash))) {
			writeFileSync(metainfoFile(torrent.infoHash), torrent.torrentFile);
		}
	} catch (error) {
		logger.error(error);
	}
	flushSeedRecords(true);
	return {
		uploadedBase: record.uploaded,
		downloadedBase: record.downloaded,
		uploadedOffset: torrent.uploaded,
		downloadedOffset: torrent.downloaded,
		seedSeconds: record.seedSeconds,
	};
}

function requiredSeedSeconds(uploaded: number, downloaded: number) {
	let required = config.torrentSeedTime;
	if (
		config.torrentSeedTimeIncrement > 0 &&
		config.torrentSeedTimeIncrementBytes > 0
	) {
		required +=
			(config.torrentSeedTimeIncrement * downloaded) /
			config.torrentSeedTimeIncrementBytes;
	}
	if (config.torrentSeedTimeRatioDiscount) {
		const target = config.torrentSeedRatio > 0 ? config.torrentSeedRatio : 1;
		const ratio = downloaded > 0 ? uploaded / downloaded : target;
		required *= 1 - Math.min(ratio, target) / target;
	}
	return required;
}

function isSeedingComplete(torrent: Torrent) {
	const seed = torrentData.get(torrent)?.seed;
	if (!seed) return true;
	const { uploaded, downloaded } = seedTotals(torrent, seed);
	if (
		config.torrentSeedRatio > 0 &&
		uploaded >= downloaded * config.torrentSeedRatio
	) {
		return true;
	}
	if (
		seedTimeEnabled &&
		seed.seedSeconds >= requiredSeedSeconds(uploaded, downloaded)
	) {
		return true;
	}
	return false;
}

function announceBeforeRemoval(torrent: Torrent) {
	const tracker = torrent.discovery?.tracker;
	const trackerCount = tracker?._trackers?.length ?? 0;
	if (!tracker || trackerCount === 0 || config.torrentAnnounceTimeout <= 0) {
		return Promise.resolve();
	}

	return new Promise<void>((resolve) => {
		let responses = 0;
		let completed = false;

		const finish = () => {
			if (completed) return;
			completed = true;
			clearTimeout(timeout);
			tracker.off("update", onUpdate);
			resolve();
		};

		const onUpdate = () => {
			responses++;
			if (responses >= trackerCount) finish();
		};

		const timeout = setTimeout(() => {
			logger.debug(
				`Final announce timed out after ${responses}/${trackerCount} tracker responses: ${torrent.name} (${torrent.infoHash})`,
			);
			finish();
		}, config.torrentAnnounceTimeout);
		timeout.unref?.();

		tracker.on("update", onUpdate);
		try {
			tracker.update({ numwant: 0 });
		} catch (error) {
			logger.error(error);
			finish();
		}
	});
}

export async function destroyTorrent(torrent: Torrent, deleteFiles?: boolean) {
	const destroyStore =
		config.torrentStorageMode === TorrentStorageMode.File
			? (deleteFiles ?? !config.torrentKeepFiles)
			: true;
	await announceBeforeRemoval(torrent);
	return new Promise<void>((resolve) => {
		if (torrent.destroyed) {
			unregisterTorrent(torrent);
			resolve();
			return;
		}
		torrent.destroy({ destroyStore }, (error) => {
			if (error) logger.error(error);
			unregisterTorrent(torrent);
			resolve();
		});
	});
}

export function scheduleRemoval(torrent: Torrent, delay: number) {
	const data = torrentData.get(torrent);
	if (!data) return;
	clearTimeout(data.timeout);
	data.timeout = setTimeout(() => {
		if (torrent.destroyed) {
			unregisterTorrent(torrent);
			return;
		}
		if (getStreams(torrent).length > 0) {
			logger.debug(`Removal cancelled: ${torrent.name} (${torrent.infoHash})`);
			return;
		}
		if (!isSeedingComplete(torrent)) {
			logger.debug(`Seeding: ${torrent.name} (${torrent.infoHash})`);
			scheduleRemoval(torrent, 60 * 1000);
			return;
		}
		logger.debug(`Removing torrent: ${torrent.name} (${torrent.infoHash})`);
		destroyTorrent(torrent);
	}, delay);
}

export function getSeedStats(torrent: Torrent) {
	const data = torrentData.get(torrent);
	if (!data?.seed) return undefined;
	const { uploaded, downloaded } = seedTotals(torrent, data.seed);
	return {
		seeding: data.streams.size === 0 && !isSeedingComplete(torrent),
		uploaded,
		downloaded,
		ratio: downloaded > 0 ? uploaded / downloaded : 0,
		secondsRemaining: seedTimeEnabled
			? Math.max(
					0,
					requiredSeedSeconds(uploaded, downloaded) - data.seed.seedSeconds,
				)
			: undefined,
	};
}

export function registerTorrent(torrent: Torrent) {
	if (torrentData.has(torrent)) return;
	if (config.torrentStorageMode === TorrentStorageMode.Memory) {
		torrent.store = new TorrentStreamChunkStore(torrent);
	}
	const seed = seedingEnabled ? initSeedState(torrent) : undefined;
	torrentData.set(torrent, {
		streams: new Map<string, TorrentStream>(),
		speeds: new LRU<number, { date: Date; upload: number; download: number }>(
			300,
		),
		seed,
		streamedFiles: new Set(seedRecords[torrent.infoHash]?.files ?? []),
	});
	logger.info(`Torrent added: ${torrent.name} (${torrent.infoHash})`);
}

export function unregisterTorrent(torrent: Torrent) {
	const data = torrentData.get(torrent);
	if (!data) return;
	clearTimeout(data.timeout);
	data.streams.forEach((stream) => {
		clearTimeout(stream.timeout);
	});
	torrentData.delete(torrent);
	if (data.seed) {
		delete seedRecords[torrent.infoHash];
		seedRecordsDirty = true;
		try {
			if (existsSync(metainfoFile(torrent.infoHash))) {
				unlinkSync(metainfoFile(torrent.infoHash));
			}
		} catch (error) {
			logger.error(error);
		}
		flushSeedRecords(true);
	}
	logger.info(`Torrent removed: ${torrent.name} (${torrent.infoHash})`);
	runGarbageCollection("A torrent was removed");
}

export function registerStream(
	id: string,
	torrent: Torrent,
	file: TorrentFile,
) {
	const data = torrentData.get(torrent);
	if (!data) throw new Error("Torrent not registered");

	let stream = data.streams.get(id);
	if (!stream) {
		clearTimeout(data.timeout);
		data.timeout = undefined;

		stream = new TorrentStream(id, torrent);
		data.streams.set(id, stream);

		logger.info(`Stream started: ${torrent.name} (${id})`);

		if (config.torrentStorageMode === TorrentStorageMode.Memory) {
			const store = torrent.store as TorrentStreamChunkStore;
			store.refreshCapacity();
		}
	}

	stream.files.set(file.path, file);

	if (!data.streamedFiles.has(file.path)) {
		data.streamedFiles.add(file.path);
		const record = seedRecords[torrent.infoHash];
		if (record && !record.files.includes(file.path)) {
			record.files.push(file.path);
			seedRecordsDirty = true;
			flushSeedRecords(true);
		}
	}

	return stream;
}

export function unregisterStream(id: string, torrent: Torrent) {
	const data = torrentData.get(torrent);
	if (!data) return;

	const stream = data.streams.get(id);
	if (!stream) return;

	clearTimeout(stream.timeout);
	data.streams.delete(id);

	logger.info(`Stream ended: ${torrent.name} (${id})`);

	if (config.torrentStorageMode === TorrentStorageMode.Memory) {
		const store = torrent.store as TorrentStreamChunkStore;
		store.refreshCapacity();
	}

	if (getStreams(torrent).length === 0) {
		applyIdleDownloadPolicy(torrent);
		scheduleRemoval(torrent, config.torrentRemoveTimeout);
	}
}

export function applyIdleDownloadPolicy(torrent: Torrent) {
	if (config.torrentStorageMode !== TorrentStorageMode.File) return;
	torrent._selections.clear();
	if (config.torrentIdleDownload) {
		const streamed = getStreamedFiles(torrent);
		for (const file of torrent.files) {
			if (streamed.has(file.path)) file.select();
		}
	}
	torrent._updateSelections();
}

export function getStreams(torrent: Torrent) {
	return torrentData.get(torrent)?.streams.values().toArray() ?? [];
}

export function getStreamedFiles(torrent: Torrent) {
	return torrentData.get(torrent)?.streamedFiles ?? new Set<string>();
}

export function getHistoricalSpeeds(torrent: Torrent) {
	return (
		torrentData
			.get(torrent)
			?.speeds.map.entries()
			.map(([, { date, download, upload }]) => ({
				date,
				download,
				upload,
			}))
			.toArray() ?? []
	);
}

function runGarbageCollection(reason: string) {
	if (typeof global.gc !== "function") return;
	global.gc();
	logger.debug(`GC triggered: ${reason}`);
}

function dropSeedRecord(infoHash: string) {
	delete seedRecords[infoHash];
	seedRecordsDirty = true;
	try {
		if (existsSync(metainfoFile(infoHash))) {
			unlinkSync(metainfoFile(infoHash));
		}
	} catch (error) {
		logger.error(error);
	}
	flushSeedRecords(true);
}

export function resumeSeedingTorrents() {
	if (!seedingEnabled) return;
	for (const infoHash of Object.keys(seedRecords)) {
		let metainfo: Buffer;
		try {
			metainfo = readFileSync(metainfoFile(infoHash));
		} catch {
			logger.warn(`Missing metainfo, dropping seed record: ${infoHash}`);
			dropSeedRecord(infoHash);
			continue;
		}
		const torrent = torrentClient.add(
			metainfo,
			{
				path: config.torrentStoragePath,
				destroyStoreOnDestroy: true,
				deselect: true,
			},
			(torrent) => {
				registerTorrent(torrent);
				applyIdleDownloadPolicy(torrent);
				scheduleRemoval(torrent, config.torrentRemoveTimeout);
				logger.info(`Seeding resumed: ${torrent.name} (${torrent.infoHash})`);
			},
		);
		torrent.once("error", () => {
			logger.warn(`Resume failed, dropping seed record: ${infoHash}`);
			dropSeedRecord(infoHash);
		});
	}
	flushSeedRecords(true);
}
