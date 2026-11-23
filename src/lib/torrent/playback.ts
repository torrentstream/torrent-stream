import MemoryChunkStore from "memory-chunk-store";
import type { FileIterator, Torrent, TorrentFile } from "webtorrent";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";
import { getTorrentClient } from "./clients";
import { seedRecords } from "./persistence";
import { waitForReady, withTimeout } from "./ready";
import {
	getTorrentByUri,
	registerStream,
	registerTorrent,
	scheduleRemoval,
	type TorrentStream,
} from "./streams";

// How long a torrent may take to get its metadata: both the longest a request
// may wait for it (the web player's prepare request) and how long it keeps
// loading in the background after shorter requests have timed out.
export const metadataDeadline = 5 * 60 * 1000;

interface PendingAdd {
	/** The torrent whose readiness is awaited. */
	readonly torrent: Torrent;
	/** Resolves with the registered torrent, or "failed" if it never got ready. */
	ready: Promise<Torrent | "failed">;
}

declare global {
	var pendingTorrentAdds: Map<string, PendingAdd> | undefined;
}

if (!global.pendingTorrentAdds) global.pendingTorrentAdds = new Map();

const pendingAdds = global.pendingTorrentAdds;

function getPendingAdd(uri: string) {
	const pending = pendingAdds.get(uri);
	if (!pending) return undefined;
	if (!pending.torrent.destroyed) return pending;
	// Normally removed once it settles, this only guards against a torrent
	// that was torn down together with its client.
	pendingAdds.delete(uri);
	return undefined;
}

function startAdd(uri: string, provider?: string) {
	const client = getTorrentClient();
	const storage = getRuntimeConfig().config.storage;
	const added = client.add(uri, {
		...(storage.mode === "memory"
			? { store: MemoryChunkStore }
			: { path: storage.path }),
		destroyStoreOnDestroy: true,
		deselect: true,
	});

	const wait = waitForReady(added, (infoHash) =>
		client.torrents.find((torrent) => torrent.infoHash === infoHash),
	);
	const deadline = setTimeout(() => {
		wait.cancel();
		// A followed duplicate belongs to whoever added it.
		if (added.destroyed) return;
		// The torrent may still be verifying files that are already on disk;
		// those must survive unless they would be deleted on removal anyway.
		const { storage } = getRuntimeConfig().config;
		const keepsFiles =
			storage.mode === "file" &&
			(storage.keepFiles || Boolean(seedRecords[added.infoHash]));
		added.destroy({ destroyStore: !keepsFiles });
	}, metadataDeadline);

	const pending: PendingAdd = {
		get torrent() {
			return wait.current();
		},
		ready: wait.ready.then((result) => {
			clearTimeout(deadline);
			if (pendingAdds.get(uri) === pending) pendingAdds.delete(uri);
			if (result !== "failed") registerTorrent(result, provider, uri);
			return result;
		}),
	};
	pendingAdds.set(uri, pending);
	return pending;
}

/**
 * Returns the torrent for the URI once its metadata is available. If that
 * takes longer than `addTimeout` the caller gets "pending", and the torrent
 * keeps loading in the background so that a retry can pick it up. "failed"
 * means the torrent could not be added and nothing is loading any more.
 */
export function getOrAddTorrent(
	uri: string,
	provider?: string,
	addTimeout = getRuntimeConfig().config.torrent.addTimeout,
) {
	const registered = getTorrentByUri(uri);
	if (registered) {
		// Restart the idle countdown so the torrent cannot be removed while this
		// request is still about to open a stream on it.
		scheduleRemoval(registered);
		return Promise.resolve<Torrent | "pending" | "failed">(registered);
	}

	const { ready } = getPendingAdd(uri) ?? startAdd(uri, provider);
	return withTimeout(ready, addTimeout);
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
