import type { Torrent, TorrentFile } from "webtorrent";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { isProviderSeedingEnabled } from "@/lib/config/schema";
import { logger } from "@/lib/logging/logger";
import { LRU } from "@/lib/lru";
import { getProvider } from "@/lib/search/provider-registry";
import { getTorrentClient } from "./clients";
import {
	dropSeedRecord,
	flushSeedRecords,
	getSeedTotals,
	initSeedState,
	recordStreamedFile,
	type SeedState,
	seedRecords,
	updateSeedRecord,
} from "./persistence";
import { TorrentStreamChunkStore } from "./store";

export interface TorrentData {
	provider?: string;
	streams: Map<string, TorrentStream>;
	speeds: LRU<number, { date: Date; upload: number; download: number }>;
	removalTimeout?: NodeJS.Timeout;
	seed?: SeedState;
	streamedFiles: Set<string>;
}

declare global {
	var torrentDataMap: Map<Torrent, TorrentData> | undefined;
	var torrentStatsInterval: NodeJS.Timeout | undefined;
}

if (!global.torrentDataMap) global.torrentDataMap = new Map();

const torrentData = global.torrentDataMap;

if (!global.torrentStatsInterval) {
	global.torrentStatsInterval = setInterval(() => {
		getTorrentClient().torrents.forEach((torrent) => {
			const data = torrentData.get(torrent);
			if (!data) return;
			const now = new Date();
			data.speeds.put(now.getTime(), {
				date: now,
				download: torrent.downloadSpeed,
				upload: torrent.uploadSpeed,
			});
			updateSeedRecord(torrent, data.seed);
		});
		flushSeedRecords();
	}, 1000);
}

export function isSeedingEnabled(provider: string | undefined) {
	const config = getRuntimeConfig().config;
	const registeredProvider = getProvider(provider);
	return (
		config.storage.mode === "file" &&
		registeredProvider !== undefined &&
		isProviderSeedingEnabled(config, registeredProvider.id)
	);
}

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
		}, getRuntimeConfig().config.torrent.idleTimeout);
	}
}

function unregisterTorrent(torrent: Torrent, preserveSeedState: boolean) {
	const data = torrentData.get(torrent);
	if (data) {
		clearTimeout(data.removalTimeout);
		data.streams.forEach((stream) => {
			clearTimeout(stream.timeout);
		});
		torrentData.delete(torrent);
	}
	if (!preserveSeedState && seedRecords[torrent.infoHash]) {
		dropSeedRecord(torrent.infoHash);
	}
	logger.info(
		`${preserveSeedState ? "Torrent suspended" : "Torrent removed"}: ${torrent.name} (${torrent.infoHash})`,
	);
	runGarbageCollection("A torrent was removed");
}

export async function destroyTorrentInternal(
	torrent: Torrent,
	options: {
		deleteFiles?: boolean;
		preserveSeedState?: boolean;
		forceDestroyStore?: boolean;
	} = {},
) {
	const data = torrentData.get(torrent);
	if (data?.seed) updateSeedRecord(torrent, data.seed);
	flushSeedRecords(true);
	const storage = getRuntimeConfig().config.storage;
	const destroyStore =
		options.forceDestroyStore ??
		(storage.mode === "file"
			? options.preserveSeedState
				? false
				: (options.deleteFiles ?? !storage.keepFiles)
			: true);
	return new Promise<void>((resolve) => {
		if (torrent.destroyed) {
			unregisterTorrent(torrent, options.preserveSeedState ?? false);
			resolve();
			return;
		}
		torrent.destroy({ destroyStore }, (error) => {
			if (error) logger.error(error);
			unregisterTorrent(torrent, options.preserveSeedState ?? false);
			resolve();
		});
	});
}

export function destroyTorrent(torrent: Torrent, deleteFiles?: boolean) {
	return destroyTorrentInternal(torrent, { deleteFiles });
}

export function scheduleRemoval(torrent: Torrent) {
	const data = torrentData.get(torrent);
	if (!data || data.seed) return;
	clearTimeout(data.removalTimeout);
	data.removalTimeout = setTimeout(() => {
		if (torrent.destroyed) {
			unregisterTorrent(torrent, Boolean(seedRecords[torrent.infoHash]));
			return;
		}
		if (data.streams.size > 0) return;
		const preserveSeedState = Boolean(seedRecords[torrent.infoHash]);
		logger.debug(
			`${preserveSeedState ? "Suspending" : "Removing"} idle torrent: ${torrent.name} (${torrent.infoHash})`,
		);
		void destroyTorrentInternal(torrent, { preserveSeedState });
	}, getRuntimeConfig().config.torrent.removeTimeout);
}

export function getSeedStats(torrent: Torrent) {
	const data = torrentData.get(torrent);
	if (!data?.seed) return undefined;
	const { uploaded, downloaded } = getSeedTotals(torrent, data.seed);
	return {
		seeding: data.streams.size === 0,
		uploaded,
		downloaded,
		ratio: downloaded > 0 ? uploaded / downloaded : 0,
	};
}

export function registerTorrent(torrent: Torrent, provider?: string) {
	if (torrentData.has(torrent)) return;
	const storageMode = getRuntimeConfig().config.storage.mode;
	if (storageMode === "memory")
		torrent.store = new TorrentStreamChunkStore(torrent);
	const seed = isSeedingEnabled(provider)
		? initSeedState(torrent, provider)
		: undefined;
	torrentData.set(torrent, {
		provider,
		streams: new Map(),
		speeds: new LRU(300),
		seed,
		streamedFiles: new Set(seedRecords[torrent.infoHash]?.files ?? []),
	});
	logger.info(`Torrent added: ${torrent.name} (${torrent.infoHash})`);
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
		clearTimeout(data.removalTimeout);
		data.removalTimeout = undefined;
		stream = new TorrentStream(id, torrent);
		data.streams.set(id, stream);
		logger.info(`Stream started: ${torrent.name} (${id})`);
		if (getRuntimeConfig().config.storage.mode === "memory") {
			(torrent.store as TorrentStreamChunkStore).refreshCapacity(
				data.streams.size,
			);
		}
	}
	stream.files.set(file.path, file);
	if (!data.streamedFiles.has(file.path)) {
		data.streamedFiles.add(file.path);
		recordStreamedFile(torrent.infoHash, file.path);
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
	if (getRuntimeConfig().config.storage.mode === "memory") {
		(torrent.store as TorrentStreamChunkStore).refreshCapacity(
			data.streams.size,
		);
	}
	if (data.streams.size === 0) {
		schedulePause(torrent);
		if (!data.seed) scheduleRemoval(torrent);
	}
}

export function schedulePause(torrent: Torrent) {
	const storage = getRuntimeConfig().config.storage;
	if (storage.mode !== "file") return;
	torrent._selections.clear();
	if (storage.idleDownload) {
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

export function getTorrentData(torrent: Torrent) {
	return torrentData.get(torrent);
}

export function getTorrentProvider(torrent: Torrent) {
	return torrentData.get(torrent)?.provider;
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
