import type { ChunkStore, Torrent } from "webtorrent";
import { config } from "../config";
import { logger } from "../logger";
import { LRU } from "../lru";
import { getStreams } from "./streams";

export class TorrentStreamChunkStore implements ChunkStore {
	torrent: Torrent;
	chunkLength: number;
	chunkStore: LRU<number, Buffer>;

	constructor(torrent: Torrent) {
		this.torrent = torrent;
		this.chunkLength = torrent.pieceLength;
		this.chunkStore = new LRU<number, Buffer>(0);
	}

	put(index: number, buf: Buffer, cb?: (err: Error | null) => void) {
		if (!this.torrent) {
			return cb?.(new Error("Torrent not set"));
		}

		const evictedChunk = this.chunkStore.put(index, buf);
		if (evictedChunk !== undefined) {
			this.onChunkEvicted(evictedChunk);
		}

		logger.debug(
			`Chunk stored, index=${index}, capacity=${this.getCapacityUsage()}, memory=${this.getMemoryUsage()}`,
		);

		cb?.(null);
	}

	get(
		index: number,
		opts?: {
			offset: number;
			length: number;
		} | null,
		cb?: (err: Error | null, buf?: Buffer) => void,
	) {
		if (!this.torrent) {
			return cb?.(new Error("Torrent not set"));
		}

		// Handle optional 'opts' argument
		if (typeof opts === "function") {
			cb = opts;
			opts = undefined;
		}

		let buf = this.chunkStore.get(index);

		if (!buf) {
			return cb?.(new Error("Chunk not found"));
		}

		const offset = opts?.offset || 0;
		const length = opts?.length || buf.length - offset;

		if (offset !== 0 || length !== buf.length) {
			buf = buf.subarray(offset, length + offset);
		}

		logger.debug(
			`Chunk retrieved, index=${index}, capacity=${this.getCapacityUsage()}, memory=${this.getMemoryUsage()}`,
		);

		cb?.(null, buf);
	}

	close(cb?: (err: Error | null) => void) {
		if (!this.torrent) {
			return cb?.(new Error("Torrent not set"));
		}

		this.chunkStore.clear();

		cb?.(null);
	}

	destroy(cb?: (err: Error | null) => void) {
		this.close(cb);
	}

	refreshCapacity() {
		const streamCount = getStreams(this.torrent).length;

		const chunksPerStream = Math.floor(
			config.streamMemoryLimit / this.chunkLength,
		);

		const capacity = (streamCount || 1) * chunksPerStream;

		const evictedChunks = this.chunkStore.updateCapacity(capacity);

		for (const evictedChunk of evictedChunks) {
			this.onChunkEvicted(evictedChunk);
		}
	}

	onChunkEvicted(index: number) {
		this.torrent._markUnverified(index);
		this.torrent._deselect(index, index);
	}

	getCapacityUsage() {
		return `${this.chunkStore.map.size}/${this.chunkStore.capacity}`;
	}

	getMemoryUsage() {
		return `${(this.chunkStore.map.size * this.chunkLength) / 1024 / 1024}MB`;
	}
}
