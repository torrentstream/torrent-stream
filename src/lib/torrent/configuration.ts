import { getRuntimeConfig } from "@/lib/config/runtime";
import type { RuntimeConfig } from "@/lib/config/schema";
import {
	applyTransferLimits,
	getTorrentClient,
	restartTorrentClients,
} from "./clients";
import {
	flushSeedRecords,
	initSeedState,
	updateSeedRecord,
} from "./persistence";
import { resumeSeedingTorrents } from "./seeding";
import type { TorrentStreamChunkStore } from "./store";
import {
	destroyTorrentInternal,
	getTorrentData,
	isSeedingEnabled,
	schedulePause,
	scheduleRemoval,
} from "./streams";

async function suspendAllTorrents(
	previousMode: RuntimeConfig["storage"]["mode"],
) {
	const torrentClient = getTorrentClient();
	const torrents = [...torrentClient.torrents];
	const interruptedStreams = torrents.reduce(
		(total, torrent) => total + (getTorrentData(torrent)?.streams.size ?? 0),
		0,
	);
	await Promise.all(
		torrents.map((torrent) =>
			destroyTorrentInternal(torrent, {
				preserveSeedState: true,
				forceDestroyStore: previousMode === "memory",
			}),
		),
	);
	return interruptedStreams;
}

export async function applyRuntimeTorrentConfig(previous: RuntimeConfig) {
	const current = getRuntimeConfig().config;
	if (
		previous.storage.mode !== current.storage.mode ||
		previous.storage.path !== current.storage.path
	) {
		const interruptedStreams = await suspendAllTorrents(previous.storage.mode);
		await restartTorrentClients();
		await resumeSeedingTorrents();
		return { interruptedStreams, clientRestarted: true };
	}

	applyTransferLimits();
	const operations: Promise<void>[] = [];
	const torrentClient = getTorrentClient();
	for (const torrent of [...torrentClient.torrents]) {
		const data = getTorrentData(torrent);
		if (!data) continue;
		for (const stream of data.streams.values()) stream.refreshTimeout();
		if (current.storage.mode === "memory") {
			(torrent.store as TorrentStreamChunkStore).refreshCapacity(
				data.streams.size,
			);
		} else {
			if (data.streams.size === 0) schedulePause(torrent);
			const enabled = isSeedingEnabled(data.provider);
			if (enabled && !data.seed) {
				data.seed = initSeedState(torrent, data.provider);
			} else if (!enabled && data.seed) {
				updateSeedRecord(torrent, data.seed);
				data.seed = undefined;
				if (data.streams.size === 0) {
					operations.push(
						destroyTorrentInternal(torrent, { preserveSeedState: true }),
					);
					continue;
				}
			}
		}
		if (!data.seed && data.streams.size === 0) scheduleRemoval(torrent);
	}
	await Promise.all(operations);
	await resumeSeedingTorrents();
	flushSeedRecords(true);
	return { interruptedStreams: 0, clientRestarted: false };
}
