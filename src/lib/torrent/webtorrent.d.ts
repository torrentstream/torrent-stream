import "webtorrent";

declare module "webtorrent" {
	export interface TorrentOptions {
		deselect?: boolean;
	}

	export type FileIterator = AsyncIterator<Uint8Array> & {
		_startPiece: number;
		_endPiece: number;
	};

	export interface TorrentFile {
		offset: number;
		[Symbol.asyncIterator](opts: { start: number; end: number }): FileIterator;
	}

	export interface ChunkStore {
		chunkLength: number;
		put(index: number, buf: Buffer, cb?: (err: Error | null) => void): void;
		get(
			index: number,
			opts?: { offset?: number; length?: number } | null,
			cb?: (err: Error | null, buf?: Buffer) => void,
		): void;
		close(cb?: (err: Error | null) => void): void;
		destroy(cb?: (err: Error | null) => void): void;
	}

	export interface SelectionItem {
		from: number;
		to: number;
		offset: number;
		priority?: number;
		notify?: () => void;
		isStreamSelection?: boolean;
		remove?: () => void;
	}

	export interface Selections {
		_items: SelectionItem[];
		insert(item: SelectionItem): void;
		remove(item: {
			from: number;
			to: number;
			isStreamSelection?: boolean;
		}): void;
		concatenate(item: SelectionItem): void;
		sort(sortFn?: (a: SelectionItem, b: SelectionItem) => number): void;
		get(index: number): SelectionItem;
		swap(i: number, j: number): void;
		clear(): void;
		readonly length: number;
		[Symbol.iterator](): Generator<SelectionItem>;
	}

	export interface Torrent {
		store: ChunkStore;
		_select(
			start: number,
			end: number,
			priority?: number,
			notify?: () => void,
			isStreamSelection?: boolean,
		): void;
		_deselect(start: number, end: number, isStreamSelection?: boolean): void;
		_selections: Selections;
		_critical: boolean[];
		_updateSelections(): void;
		_markUnverified(chunkIndex: number): void;
	}
}
