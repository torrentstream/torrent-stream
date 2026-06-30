import MemoryChunkStore from "memory-chunk-store";
import type { FileIterator, Torrent, TorrentFile } from "webtorrent";
import { getRuntimeConfig } from "@/lib/config";
import { createLimit } from "@/lib/limit";
import { logger } from "@/lib/logger";
import { LRU } from "@/lib/lru";
import { getInfoClient, getTorrentClient } from "./clients";
import { registerStream, registerTorrent, type TorrentStream } from "./streams";
import { TorrentInfo } from "./types";

const torrentInfoCache = new LRU<string, Promise<TorrentInfo | undefined>>(500);
const limitFetchTorrentInfo = createLimit(10);

export function getTorrentInfo(uri: string) {
	const cached = torrentInfoCache.get(uri);
	if (cached) return cached;

	const promise = limitFetchTorrentInfo(() => fetchTorrentInfo(uri)).then(
		(info) => {
			if (!info) torrentInfoCache.delete(uri);
			return info;
		},
	);

	torrentInfoCache.put(uri, promise);
	return promise;
}

function fetchTorrentInfo(uri: string) {
	return new Promise<TorrentInfo | undefined>((resolve) => {
		let completed = false;

		const onTorrent = (torrent: Torrent) => {
			if (completed) return;
			if (torrent.destroyed) {
				completed = true;
				clearTimeout(timeout);
				resolve(undefined);
				return;
			}
			if (!torrent.ready) {
				torrent.once("ready", () => onTorrent(torrent));
				return;
			}
			completed = true;
			clearTimeout(timeout);
			const info = new TorrentInfo(torrent);
			torrent.destroy();
			resolve(info);
		};

		const torrent = getInfoClient().add(
			uri,
			{
				store: MemoryChunkStore,
				destroyStoreOnDestroy: true,
			},
			onTorrent,
		);

		const timeout = setTimeout(() => {
			if (completed) return;
			completed = true;
			torrent.destroy();
			resolve(undefined);
		}, getRuntimeConfig().config.torrent.addTimeout);
	});
}

export function getOrAddTorrent(uri: string, provider?: string) {
	return new Promise<Torrent | undefined>((resolve) => {
		let completed = false;

		const onTorrent = (torrent: Torrent) => {
			if (completed) return;
			if (torrent.destroyed) {
				completed = true;
				clearTimeout(timeout);
				resolve(undefined);
				return;
			}
			if (!torrent.ready) {
				torrent.once("ready", () => onTorrent(torrent));
				return;
			}
			completed = true;
			clearTimeout(timeout);
			registerTorrent(torrent, provider);
			resolve(torrent);
		};

		const torrent = getTorrentClient().add(
			uri,
			{
				...(getRuntimeConfig().config.storage.mode === "memory"
					? { store: MemoryChunkStore }
					: { path: getRuntimeConfig().config.storage.path }),
				destroyStoreOnDestroy: true,
				deselect: true,
			},
			onTorrent,
		);

		const timeout = setTimeout(() => {
			if (completed) return;
			completed = true;
			torrent.destroy();
			resolve(undefined);
		}, getRuntimeConfig().config.torrent.addTimeout);
	});
}

export function getReadableStream(
	id: string,
	torrent: Torrent,
	file: TorrentFile,
	start: number,
	end: number,
) {
	let stream: TorrentStream;
	let iterator: FileIterator;
	let cancelled = false;

	return new ReadableStream({
		start() {
			iterator = file[Symbol.asyncIterator]({ start, end });
			stream = registerStream(id, torrent, file);
			stream.refreshTimeout();
		},
		async pull(controller) {
			try {
				stream.refreshTimeout();

				const { value, done } = await iterator.next();

				if (cancelled) return;

				if (done) {
					controller.close();
					return;
				}

				controller.enqueue(value);
			} catch (err) {
				logger.error(err);
				controller.error(err);
			}
		},
		cancel() {
			cancelled = true;
			iterator.return?.();
		},
	});
}
