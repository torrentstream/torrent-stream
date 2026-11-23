import MemoryChunkStore from "memory-chunk-store";
import type { FileIterator, Torrent, TorrentFile } from "webtorrent";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";
import { getTorrentClient } from "./clients";
import { seedRecords } from "./persistence";
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
	torrent: Torrent;
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
	// Normally removed by the "close" listener, this only guards against a
	// torrent that was torn down together with its client.
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

	let resolve!: (result: Torrent | "failed") => void;
	const pending: PendingAdd = {
		torrent: added,
		ready: new Promise((resolver) => {
			resolve = resolver;
		}),
	};

	const settle = (result: Torrent | "failed") => {
		clearTimeout(deadline);
		pending.torrent.off("ready", onReady);
		pending.torrent.off("close", onClose);
		if (pendingAdds.get(uri) === pending) pendingAdds.delete(uri);
		resolve(result);
	};
	const onReady = () => {
		registerTorrent(pending.torrent, provider, uri);
		settle(pending.torrent);
	};
	const onClose = () => {
		// WebTorrent destroys a torrent whose info hash is already in the client;
		// the surviving torrent is then the one to wait for.
		const { infoHash } = pending.torrent;
		const duplicate = infoHash
			? client.torrents.find((torrent) => torrent.infoHash === infoHash)
			: undefined;
		if (duplicate) follow(duplicate);
		else settle("failed");
	};
	const follow = (torrent: Torrent) => {
		pending.torrent = torrent;
		if (torrent.ready) return onReady();
		torrent.once("ready", onReady);
		torrent.once("close", onClose);
	};
	const deadline = setTimeout(() => {
		settle("failed");
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

	pendingAdds.set(uri, pending);
	follow(added);
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
	return new Promise<Torrent | "pending" | "failed">((resolve) => {
		const timeout = setTimeout(() => resolve("pending"), addTimeout);
		void ready.then((result) => {
			clearTimeout(timeout);
			resolve(result);
		});
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
