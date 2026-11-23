import * as cheerio from "cheerio";
import type { SessionCredentials } from "@/lib/search/session";

const unitExponents: Record<string, number> = { k: 1, m: 2, g: 3, t: 4 };

/** Parses "1.4 GB", "1,4 GiB" or "700MiB" into bytes; 0 when unreadable. */
export function parseSize(text: string | undefined) {
	const match = text?.replace(",", ".").match(/([\d.]+)\s*([kmgt]?)i?b/i);
	if (!match) return 0;

	const exponent = unitExponents[match[2].toLowerCase()] ?? 0;
	return Math.ceil((Number(match[1]) || 0) * 1024 ** exponent);
}

export function requireCredentials(
	providerName: string,
	{ username, password }: Partial<SessionCredentials>,
): SessionCredentials {
	if (!username || !password) {
		throw new Error(`${providerName} credentials are not configured`);
	}
	return { username, password };
}

/**
 * Reads the torrent names off a tracker's hit-and-run page. A page without
 * any entry only counts as an empty list when `pageMarker` proves that it is
 * the list page; anything else (maintenance page, bot challenge, changed
 * layout) throws, so that it is never mistaken for "nothing left to seed".
 */
export function parseSeedRequirements(
	providerName: string,
	html: string,
	selectors: { entries: string; pageMarker: string },
) {
	const $ = cheerio.load(html);
	const names = $(selectors.entries)
		.map((_index, element) => $(element).attr("title") ?? $(element).text())
		.get();
	if (names.length === 0 && $(selectors.pageMarker).length === 0) {
		throw new Error(`${providerName} H&R page was not recognised`);
	}
	return names;
}
