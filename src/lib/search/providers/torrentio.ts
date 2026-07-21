import { getRuntimeConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";
import { TorrentCategory, TorrentSearchProvider } from "@/lib/search/provider";
import { TorrentSearchResult } from "@/lib/search/result";
import type { StremioStream } from "@/lib/search/stremio";

const torrentioTrackers = [
	{ id: "yts", name: "YTS" },
	{ id: "eztv", name: "EZTV" },
	{ id: "rarbg", name: "RARBG" },
	{ id: "1337x", name: "1337x" },
	{ id: "thepiratebay", name: "The Pirate Bay" },
	{ id: "kickasstorrents", name: "KickassTorrents" },
	{ id: "torrentgalaxy", name: "TorrentGalaxy" },
	{ id: "magnetdl", name: "MagnetDL" },
	{ id: "horriblesubs", name: "HorribleSubs" },
	{ id: "nyaasi", name: "Nyaa.si" },
	{ id: "tokyotosho", name: "Tokyo Toshokan" },
	{ id: "anidex", name: "AniDex" },
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
				return this.searchTorrents(trackers, "tv", query, season, episode);
		}
	}

	async searchTorrents(
		providers: string[],
		category: "movie" | "tv",
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
				signal: AbortSignal.timeout(
					getRuntimeConfig().config.search.requestTimeout,
				),
			});
			const responseJson = (await response.json()) as {
				streams: StremioStream[];
			};

			for (const stream of responseJson.streams) {
				const name =
					stream.title?.split("\n")[0].replace("⭐", "") ||
					stream.behaviorHints?.filename ||
					stream.name;

				const fileName = stream.behaviorHints?.filename;

				const fileIndex = stream.fileIdx;

				const tracker =
					stream.title?.split("⚙️ ")[1]?.split("\n")[0] || "Torrentio";
				const category = stream.name.split("\n")[1] || undefined;

				const size = this.parseSize(
					stream.title?.split("💾 ")[1]?.split(" ⚙️")[0],
				);

				const seeds =
					Number(stream.title?.split("👤 ")[1]?.split(" 💾")[0]) || undefined;

				const trackers = (stream.sources || [])
					.map((tr) => `&tr=${encodeURIComponent(tr)}`)
					.join("");

				const magnet = `magnet:?xt=urn:btih:${stream.infoHash}${trackers}`;

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
		} catch (error) {
			logger.error(error);
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

	private parseSize(size: string | undefined) {
		if (!size) return 0;

		const units = {
			TB: 1024 ** 4,
			GB: 1024 ** 3,
			MB: 1024 ** 2,
			KB: 1024,
			B: 1,
		};

		const [sizeStr, unit] = size.split(" ");
		const sizeNum = Number(sizeStr);

		if (!sizeNum || !units[unit]) return 0;

		return Math.ceil(sizeNum * units[unit]);
	}
}
