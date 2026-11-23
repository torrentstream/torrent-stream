/** The part of a WebTorrent torrent that waiting for its metadata needs. */
export interface LoadingTorrent {
	readonly ready: boolean;
	readonly infoHash: string;
	once(event: "ready" | "close", listener: () => void): unknown;
	off(event: "ready" | "close", listener: () => void): unknown;
}

export interface ReadyWait<T extends LoadingTorrent> {
	/** Resolves with the torrent once ready, or "failed". */
	ready: Promise<T | "failed">;
	/** The torrent currently waited for: the added one or its duplicate. */
	current(): T;
	/** Gives up waiting; `ready` resolves with "failed". */
	cancel(): void;
}

/**
 * Waits until `torrent` has its metadata. WebTorrent destroys a torrent whose
 * info hash is already in the client, so when it closes, the surviving
 * duplicate found by `findDuplicate` is waited for instead.
 */
export function waitForReady<T extends LoadingTorrent>(
	torrent: T,
	findDuplicate: (infoHash: string) => T | undefined,
): ReadyWait<T> {
	let current = torrent;
	let settled = false;
	let resolve!: (result: T | "failed") => void;
	const ready = new Promise<T | "failed">((resolver) => {
		resolve = resolver;
	});

	const settle = (result: T | "failed") => {
		if (settled) return;
		settled = true;
		current.off("ready", onReady);
		current.off("close", onClose);
		resolve(result);
	};
	const onReady = () => settle(current);
	const onClose = () => {
		current.off("ready", onReady);
		const duplicate = current.infoHash
			? findDuplicate(current.infoHash)
			: undefined;
		if (duplicate && duplicate !== current) follow(duplicate);
		else settle("failed");
	};
	const follow = (next: T) => {
		current = next;
		if (next.ready) return settle(next);
		next.once("ready", onReady);
		next.once("close", onClose);
	};

	follow(torrent);
	return { ready, current: () => current, cancel: () => settle("failed") };
}

/** Resolves with `result`, or with "pending" if it takes longer than `ms`. */
export function withTimeout<T>(result: Promise<T>, ms: number) {
	return new Promise<T | "pending">((resolve) => {
		const timeout = setTimeout(() => resolve("pending"), ms);
		void result.then((value) => {
			clearTimeout(timeout);
			resolve(value);
		});
	});
}
