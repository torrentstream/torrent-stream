import * as cheerio from "cheerio";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";
import { isImdbId } from "@/lib/media/imdb";
import { TorrentCategory, TorrentSearchProvider } from "@/lib/search/provider";
import { TorrentSearchResult } from "@/lib/search/result";

const movieCategories = "2000,2030,2040";
const seriesCategories = "5000,5030,5040";
const maxResponseSize = 16 * 1024 * 1024;

interface TorznabFeed {
	url: string;
	apiKey: string;
}

interface TorznabRelease {
	name: string;
	tracker: string;
	size: number;
	seeds: number;
	peers: number;
	magnet?: string;
	torrent?: string;
}

export class TorznabProvider extends TorrentSearchProvider {
	id = "torznab" as const;
	name = "Torznab";

	async searchTorrentsByCategory(
		query: string,
		category: TorrentCategory,
		season?: number,
		episode?: number,
	) {
		const params = new URLSearchParams({ extended: "1" });
		const imdb = isImdbId(query) ? query : undefined;

		switch (category) {
			case TorrentCategory.Movie:
				params.set("t", imdb ? "movie" : "search");
				params.set(imdb ? "imdbid" : "q", query);
				params.set("cat", movieCategories);
				break;
			case TorrentCategory.Series:
				params.set("t", "tvsearch");
				params.set(imdb ? "imdbid" : "q", query);
				params.set("cat", seriesCategories);
				if (season !== undefined && season !== 0) {
					params.set("season", season.toString());
				}
				if (episode !== undefined && episode !== 0) {
					params.set("ep", episode.toString());
				}
				break;
		}

		const feeds = getRuntimeConfig().config.providers.torznab.feeds.filter(
			(feed) => feed.url.trim(),
		);
		const results = await Promise.all(
			feeds.map(async (feed) => {
				try {
					return await this.searchFeed(feed, params, imdb, season, episode);
				} catch (error) {
					logger.error(error);
					return [];
				}
			}),
		);

		return results.flat();
	}

	async getSeedRequirements() {
		return [];
	}

	private async searchFeed(
		feed: TorznabFeed,
		params: URLSearchParams,
		imdb?: string,
		season?: number,
		episode?: number,
	) {
		const url = this.getRequestUrl(feed, params);
		const response = await fetch(url, {
			headers: {
				Accept: "application/rss+xml, application/xml, text/xml",
			},
			signal: AbortSignal.timeout(
				getRuntimeConfig().config.search.requestTimeout,
			),
		});
		if (!response.ok) {
			throw new Error(
				`Torznab returned ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.arrayBuffer();
		if (data.byteLength > maxResponseSize) {
			throw new Error("Torznab response is larger than 16 MB");
		}

		const releases = this.parseResponse(new TextDecoder().decode(data), url);
		const torrents = releases.map(
			(release) =>
				new TorrentSearchResult({
					...release,
					imdb,
					provider: this.id,
				}),
		);

		return season !== undefined && episode !== undefined
			? torrents.filter((torrent) => torrent.isCorrectEpisode(season, episode))
			: torrents;
	}

	private getRequestUrl(feed: TorznabFeed, params: URLSearchParams) {
		let url: URL;
		try {
			url = new URL(feed.url.trim());
		} catch {
			throw new Error("Torznab feed has an invalid endpoint URL");
		}
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new Error("Torznab feed must use HTTP or HTTPS");
		}

		for (const [name, value] of params) {
			url.searchParams.set(name, value);
		}
		if (feed.apiKey.trim()) url.searchParams.set("apikey", feed.apiKey.trim());
		return url;
	}

	private parseResponse(xml: string, requestUrl: URL) {
		const $ = cheerio.load(xml, { xmlMode: true });
		const root = $.root().children().first();
		const rootName = this.localName(root.prop("tagName"));

		if (rootName === "error") {
			throw new Error(
				root.attr("description") ||
					`Torznab error ${root.attr("code") || "unknown"}`,
			);
		}
		if (rootName !== "rss") {
			throw new Error(`Unexpected Torznab XML root "${rootName}"`);
		}

		const channel = root.children().filter((_index, element) => {
			return this.localName(element.tagName) === "channel";
		});
		const source = this.sourceProvider(
			this.childText($, channel, "title"),
			this.childText($, channel, "description"),
			this.childText($, channel, "generator"),
		);
		const baseUrl = new URL(requestUrl);
		baseUrl.search = "";
		baseUrl.hash = "";

		const releases: TorznabRelease[] = [];
		channel.children().each((_index, element) => {
			if (this.localName(element.tagName) !== "item") return;
			const item = $(element);
			const attrs = new Map<string, string>();
			item.children().each((_childIndex, child) => {
				if (this.localName(child.tagName) !== "attr") return;
				const name = $(child).attr("name")?.trim().toLowerCase();
				if (name) attrs.set(name, $(child).attr("value")?.trim() || "");
			});

			const enclosure = item.children("enclosure").first();
			const candidates = [
				attrs.get("magneturl"),
				enclosure.attr("url"),
				this.childText($, item, "link"),
				this.childText($, item, "guid"),
			];
			let magnet = this.firstMagnet(...candidates);
			const infoHash =
				attrs.get("infohash")?.trim() || this.infoHashFromMagnet(magnet);
			if (!magnet && infoHash) magnet = `magnet:?xt=urn:btih:${infoHash}`;

			const torrent = magnet
				? undefined
				: this.firstDownloadUrl(baseUrl, ...candidates);
			if (!magnet && !torrent) return;

			const tracker = this.firstNonEmpty(
				this.childText($, item, "jackettindexer"),
				this.childText($, item, "prowlarrindexer"),
				attrs.get("jackettindexer"),
				attrs.get("prowlarrindexer"),
				attrs.get("indexer"),
				source,
			);
			const name = this.childText($, item, "title");
			if (!name) return;

			releases.push({
				name,
				tracker,
				size: this.numericValue(
					this.firstNonEmpty(attrs.get("size"), enclosure.attr("length")),
				),
				seeds: this.numericValue(attrs.get("seeders")),
				peers: this.numericValue(
					this.firstNonEmpty(attrs.get("peers"), attrs.get("leechers")),
				),
				magnet,
				torrent,
			});
		});

		return releases;
	}

	private childText(
		$: cheerio.CheerioAPI,
		parent: ReturnType<cheerio.CheerioAPI>,
		name: string,
	) {
		return (
			parent
				.children()
				.filter((_index, element) => this.localName(element.tagName) === name)
				.first()
				.text()
				.trim() || ""
		);
	}

	private localName(name: string | null | undefined) {
		return (name || "").toLowerCase().split(":").at(-1) || "";
	}

	private firstNonEmpty(...values: Array<string | undefined>) {
		return values.find((value) => value?.trim())?.trim() || "";
	}

	private firstMagnet(...values: Array<string | undefined>) {
		return values
			.find((value) => value?.trim().toLowerCase().startsWith("magnet:?"))
			?.trim();
	}

	private firstDownloadUrl(baseUrl: URL, ...values: Array<string | undefined>) {
		for (const candidate of values) {
			const value = candidate?.trim();
			if (!value || value.toLowerCase().startsWith("magnet:?")) continue;
			if (!value.startsWith("/") && !/^https?:\/\//i.test(value)) continue;
			try {
				const url = new URL(value, baseUrl);
				if (url.protocol === "http:" || url.protocol === "https:") {
					return url.toString();
				}
			} catch {
				// Try the next candidate.
			}
		}
		return undefined;
	}

	private infoHashFromMagnet(magnet: string | undefined) {
		if (!magnet) return "";
		const match = magnet.match(/[?&]xt=urn:btih:([^&]+)/i);
		if (!match) return "";
		try {
			return decodeURIComponent(match[1]).trim();
		} catch {
			return "";
		}
	}

	private numericValue(value: string | undefined) {
		const number = Number(value?.trim());
		return Number.isSafeInteger(number) && number >= 0 ? number : 0;
	}

	private sourceProvider(
		title: string,
		description: string,
		generator: string,
	) {
		const identity = `${title} ${description} ${generator}`.toLowerCase();
		if (identity.includes("prowlarr")) return "Prowlarr";
		if (identity.includes("harbrr")) return "Harbrr";
		if (
			identity.includes("jackett") ||
			title.trim().toLowerCase() === "aggregatesearch" ||
			identity.includes("configured trackers")
		) {
			return "Jackett";
		}
		return "Torznab";
	}
}
