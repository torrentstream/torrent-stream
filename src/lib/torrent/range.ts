export interface ByteRange {
	/** First byte to serve. */
	start: number;
	/** Last byte to serve, inclusive. */
	end: number;
	/** Whether the client asked for a range (206) or gets the whole file (200). */
	partial: boolean;
}

const rangePattern = /^bytes=\s*(\d*)\s*-\s*(\d*)\s*(?:,|$)/i;

/**
 * Resolves a Range request header against a file of `length` bytes, following
 * RFC 9110: a missing or syntactically invalid header means the whole file,
 * and a valid range that does not overlap the file is "unsatisfiable" (416).
 * Only the first range of a multi-range request is served.
 */
export function parseRange(
	header: string | null | undefined,
	length: number,
): ByteRange | "unsatisfiable" {
	const whole = { start: 0, end: length - 1, partial: false };
	const match = header ? rangePattern.exec(header.trim()) : null;
	if (!match) return whole;

	const [, first, last] = match;
	if (!first && !last) return whole;

	if (!first) {
		const suffixLength = Number(last);
		if (!Number.isSafeInteger(suffixLength)) return whole;
		if (suffixLength === 0 || length === 0) return "unsatisfiable";
		return {
			start: Math.max(length - suffixLength, 0),
			end: length - 1,
			partial: true,
		};
	}

	const start = Number(first);
	const end = last ? Number(last) : length - 1;
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return whole;
	if (last && end < start) return whole;
	if (start >= length) return "unsatisfiable";
	return { start, end: Math.min(end, length - 1), partial: true };
}

export interface MemoryWindow {
	/** Byte offset of the file within the torrent. */
	fileOffset: number;
	fileLength: number;
	pieceLength: number;
	/** Memory one stream may use (the storage's `streamMemoryLimit`). */
	memoryLimit: number;
}

/**
 * In memory mode a response may only cover what fits in the stream's share of
 * memory: the rest of the piece it starts in, plus whole pieces until half the
 * memory limit is used. A capped range is always partial, even when the client
 * asked for the whole file.
 */
export function capToMemoryWindow(
	range: ByteRange,
	{ fileOffset, fileLength, pieceLength, memoryLimit }: MemoryWindow,
): ByteRange {
	const startByte = fileOffset + range.start;
	const bytesUntilNextPiece = pieceLength - (startByte % pieceLength);
	const pieces = Math.max(1, Math.floor(memoryLimit / pieceLength / 2));
	const maxLength = bytesUntilNextPiece + (pieces - 1) * pieceLength;

	if (range.end - range.start < maxLength) return range;
	return {
		start: range.start,
		end: Math.min(range.start + maxLength - 1, fileLength - 1),
		partial: true,
	};
}
