import MemoryChunkStore from "memory-chunk-store";
import type { FileIterator, Torrent, TorrentFile } from "webtorrent";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";
import { getTorrentClient } from "./clients";
import { registerStream, registerTorrent, type TorrentStream } from "./streams";

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
