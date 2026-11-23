import { getRuntimeConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";
import { TorrentCategory, TorrentSearchProvider } from "@/lib/search/provider";
import {
	recordSearchFailure,
	recordSearchSuccess,
} from "@/lib/search/provider-status";
import { TorrentSearchResult } from "@/lib/search/result";
import type { StremioStream } from "@/lib/search/stremio";
import { parseSize } from "./shared";

const torrentioTrackers = [
	{ id: "yts", name: "YTS" },
	{ id: "eztv", name: "EZTV" },
	{ id: "rarbg", name: "RARBG" },
	{ id: "1337x", name: "1337x" },
	{ id: "ext", name: "EXT" },
	{ id: "thepiratebay", name: "The Pirate Bay" },
	{ id: "kickasstorrents", name: "KickassTorrents" },
	{ id: "torrentgalaxy", name: "TorrentGalaxy" },
	{ id: "uindex", name: "UIndex" },
	{ id: "knaben", name: "Knaben" },
	{ id: "magnetdl", name: "MagnetDL" },
	{ id: "horriblesubs", name: "HorribleSubs" },
	{ id: "nyaasi", name: "Nyaa.si" },
	{ id: "animetosho", name: "AnimeTosho" },
	{ id: "tokyotosho", name: "Tokyo Toshokan" },
	{ id: "anidex", name: "AniDex" },
	{ id: "nekobt", name: "nekoBT" },
	{ id: "rutor", name: "Rutor" },
	{ id: "rutracker", name: "RuTracker" },
	{ id: "comando", name: "Comando" },
	{ id: "bludv", name: "BluDV" },
	{ id: "micoleaodublado", name: "Mico Leão Dublado" },
	{ id: "torrent9", name: "Torrent9" },
	{ id: "ilcorsaronero", name: "Il Corsaro Nero" },
	{ id: "mejortorrent", name: "MejorTorrent" },
	{ id: "wolfmax4k", name: "WolfMax4K" },
	{ id: "cinecalidad", name: "CineCalidad" },
	{ id: "besttorrents", name: "BestTorrents" },
] as const;

const torrentioTrackerIds = new Set<string>(
	torrentioTrackers.map(({ id }) => id),
);

export class TorrentioProvider extends TorrentSearchProvider {
	id = "torrentio" as const;
	name = "Torrentio";
	override trackers = torrentioTrackers.map((tracker) => ({ ...tracker }));

	async searchTorrentsByCategory(
		query: string,
		category: TorrentCategory,
		season?: number,
		episode?: number,
	) {
		const trackers = this.enabledTrackers();
		if (!this.allTrackersEnabled() && trackers.length === 0) return [];

		switch (category) {
			case TorrentCategory.Movie:
				return this.searchTorrents(trackers, "movie", query);
			case TorrentCategory.Series:
				return this.searchTorrents(trackers, "series", query, season, episode);
		}
	}

	async searchTorrents(
		providers: string[],
		category: "movie" | "series",
		imdb: string,
		season?: number,
		episode?: number,
	) {
		const torrents: TorrentSearchResult[] = [];

		try {
			const configParam = `providers=${providers.join(",")}`;
			const json = `${category === "movie" ? `${imdb}` : `${imdb}:${season}:${episode}`}.json`;

			const url = [
				`https://torrentio.strem.fun`,
				...(this.allTrackersEnabled() ? [] : [configParam]),
				`stream`,
				category,
				json,
			].join("/");

			const response = await fetch(url, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(
					getRuntimeConfig().config.search.requestTimeout,
				),
			});
			if (!response.ok) {
				throw new Error(
					`Torrentio returned ${response.status} ${response.statusText}`,
				);
			}

			const responseJson = (await response.json()) as {
				streams?: StremioStream[];
			};

			for (const stream of responseJson.streams || []) {
				const infoHash = stream.infoHash?.trim().toLowerCase();
				if (!infoHash || !this.isValidInfoHash(infoHash)) continue;

				const name =
					stream.title?.split("\n")[0].replace("⭐", "").trim() ||
					stream.behaviorHints?.filename ||
					stream.name;

				const fileName = stream.behaviorHints?.filename;

				const fileIndex = stream.fileIdx;

				const tracker =
					stream.title?.split("⚙️ ")[1]?.split("\n")[0] || "Torrentio";
				const category = stream.name.split("\n")[1] || undefined;

				const size = parseSize(stream.title?.split("💾 ")[1]?.split(" ⚙️")[0]);

				// Missing or unreadable seeders are unknown, not 0.
				const seedsText = stream.title?.split("👤 ")[1]?.split(" 💾")[0];
				const seeds =
					seedsText?.trim() && Number.isFinite(Number(seedsText))
						? Number(seedsText)
						: undefined;

				const trackers = this.getTrackers(stream.sources)
					.map((tr) => `&tr=${encodeURIComponent(tr)}`)
					.join("");

				const magnet = `magnet:?xt=urn:btih:${infoHash}${trackers}`;

				torrents.push(
					new TorrentSearchResult({
						name,
						fileName,
						fileIndex,
						imdb,
						season,
						episode,
						tracker,
						category,
						size,
						seeds,
						magnet,
						provider: this.id,
					}),
				);
			}

			recordSearchSuccess(this.id, torrents.length);
		} catch (error) {
			logger.error(error);
			recordSearchFailure(this.id, error);
		}

		return torrents;
	}

	override async getSeedRequirements() {
		return [];
	}

	private allTrackersEnabled() {
		return getRuntimeConfig().config.providers.torrentio.allTrackers;
	}

	private enabledTrackers() {
		return getRuntimeConfig().config.providers.torrentio.sources.filter(
			(source) => torrentioTrackerIds.has(source),
		);
	}

	private isValidInfoHash(infoHash: string) {
		return /^[a-f0-9]{40}$/i.test(infoHash) || /^[a-z2-7]{32}$/i.test(infoHash);
	}

	private getTrackers(sources: string[] | undefined) {
		const trackers = new Set<string>();

		for (const source of sources || []) {
			const trimmed = source.trim();
			const tracker = trimmed.startsWith("tracker:")
				? trimmed.slice("tracker:".length)
				: trimmed;

			if (!/^(?:https?|udp|wss):\/\//i.test(tracker)) continue;
			trackers.add(tracker);
		}

		// Supplement Torrentio's sources with public trackers for peer discovery.
		// Snapshot from:
		// https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt
		for (const tracker of [
			"udp://tracker.opentrackr.org:1337/announce",
			"udp://open.stealth.si:80/announce",
			"udp://open.demonii.com:1337/announce",
			"udp://tracker.skynetcloud.site:6969/announce",
			"udp://tracker.qu.ax:6969/announce",
			"udp://exodus.desync.com:6969/announce",
			"udp://tracker.gmi.gd:6969/announce",
			"udp://tracker.nyaa.vc:6969/announce",
			"udp://explodie.org:6969/announce",
			"udp://tracker.corpscorp.online:80/announce",
			"udp://tracker.bittor.pw:1337/announce",
			"udp://tracker-udp.gbitt.info:80/announce",
			"udp://tracker.ducks.party:1984/announce",
			"http://tracker2.dler.org:80/announce",
			"http://tracker.dler.org:6969/announce",
			"http://tracker.dler.com:6969/announce",
			"http://tracker.renfei.net:8080/announce",
			"udp://retracker01-msk-virt.corbina.net:80/announce",
			"udp://tracker.peerfect.org:6969/announce",
			"udp://tracker.opentrackr.com:6969/announce",
		]) {
			trackers.add(tracker);
		}
		return [...trackers];
	}
}
