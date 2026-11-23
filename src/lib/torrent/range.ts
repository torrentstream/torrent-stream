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
