import MemoryChunkStore from "memory-chunk-store";
import type { FileIterator, Torrent, TorrentFile } from "webtorrent";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";
import { getTorrentClient } from "./clients";
import { registerStream, registerTorrent, type TorrentStream } from "./streams";

export function getOrAddTorrent(
	uri: string,
	provider?: string,
	addTimeout = getRuntimeConfig().config.torrent.addTimeout,
) {
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
			registerTorrent(torrent, provider, uri);
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
		}, addTimeout);
	});
}

export function getReadableStream(
	id: string,
	torrent: Torrent,
	file: TorrentFile,
	start: number,
	end: number,
	signal?: AbortSignal,
) {
	let stream: TorrentStream;
	let iterator: FileIterator;
	let cancelled = false;
	let keepAlive: ReturnType<typeof setInterval> | undefined;
	const cleanup = () => {
		clearInterval(keepAlive);
		signal?.removeEventListener("abort", cancel);
	};
	const cancel = () => {
		if (cancelled) return;
		cancelled = true;
		cleanup();
		void iterator.return?.();
	};

	return new ReadableStream({
		start() {
			iterator = file[Symbol.asyncIterator]({ start, end });
			stream = registerStream(id, torrent, file);
			stream.refreshTimeout();
			signal?.addEventListener("abort", cancel, { once: true });
			if (signal?.aborted) cancel();
		},
		async pull(controller) {
			if (cancelled) {
				controller.close();
				return;
			}
			// Waiting on slow peers is still an active read, not an idle stream.
			keepAlive = setInterval(
				() => {
					if (!cancelled) stream.refreshTimeout();
				},
				Math.max(100, getRuntimeConfig().config.torrent.idleTimeout / 2),
			);
			try {
				stream.refreshTimeout();

				const { value, done } = await iterator.next();

				if (cancelled) return;

				if (done) {
					cleanup();
					controller.close();
					return;
				}

				controller.enqueue(value);
			} catch (err) {
				cleanup();
				if (cancelled) return;
				void iterator.return?.();
				logger.error(err);
				controller.error(err);
			} finally {
				clearInterval(keepAlive);
			}
		},
		cancel,
	});
}
