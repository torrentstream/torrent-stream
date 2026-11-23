import * as cheerio from "cheerio";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";
import { isImdbId } from "@/lib/media/imdb";
import { TorrentCategory, TorrentSearchProvider } from "@/lib/search/provider";
import {
	recordSearchFailure,
	recordSearchSuccess,
} from "@/lib/search/provider-status";
import { TorrentSearchResult } from "@/lib/search/result";
import {
	AuthenticatedSession,
	type SessionCredentials,
} from "@/lib/search/session";
import { parseSeedRequirements, parseSize, requireCredentials } from "./shared";

enum NcoreCategory {
	Film_SD_HU = "xvid_hun",
	Film_SD_EN = "xvid",
	Film_HD_HU = "hd_hun",
	Film_HD_EN = "hd",
	Sorozat_SD_HU = "xvidser_hun",
	Sorozat_SD_EN = "xvidser",
	Sorozat_HD_HU = "hdser_hun",
	Sorozat_HD_EN = "hdser",
}

type NcoreCredentials = SessionCredentials;

export class NcoreProvider extends TorrentSearchProvider {
	id = "ncore" as const;
	name = "nCore";

	private session = new AuthenticatedSession({
		name: this.name,
		origin: "https://ncore.pro",
		loginUrl: "https://ncore.pro/login.php",
		requestTimeout: () => getRuntimeConfig().config.search.requestTimeout,
		createLoginBody: (credentials) => {
			const formData = new FormData();
			formData.append("nev", credentials.username);
			formData.append("pass", credentials.password);
			formData.append("set_lang", "hu");
			formData.append("submitted", "1");
			return formData;
		},
		isLoginSuccessful: (_response, redirectUrl) =>
			Boolean(redirectUrl && redirectUrl.pathname !== "/login.php"),
		isLoginRedirect: (redirectUrl) => redirectUrl?.pathname === "/login.php",
	});

	async getSeedRequirements() {
		const credentials = this.getCredentials();
		const response = await this.session.fetch(
			"https://ncore.pro/hitnrun.php?showall=false",
			credentials,
		);
		if (!response.ok) {
			throw new Error(`nCore H&R request failed (${response.status})`);
		}
		return parseSeedRequirements(this.name, await response.text(), {
			// Each listed torrent is a row with its full name in the link's title.
			entries: "div.hnr_tname > a[title]",
			// The list container, rendered even when nothing is listed.
			pageMarker: "div.hnr_torrents",
		});
	}

	async searchTorrentsByCategory(query: string, category: TorrentCategory) {
		switch (category) {
			case TorrentCategory.Movie:
				return this.searchTorrents(query, [
					NcoreCategory.Film_SD_HU,
					NcoreCategory.Film_SD_EN,
					NcoreCategory.Film_HD_HU,
					NcoreCategory.Film_HD_EN,
				]);
			case TorrentCategory.Series:
				return this.searchTorrents(query, [
					NcoreCategory.Sorozat_SD_HU,
					NcoreCategory.Sorozat_SD_EN,
					NcoreCategory.Sorozat_HD_HU,
					NcoreCategory.Sorozat_HD_EN,
				]);
		}
	}

	async searchTorrents(
		query: string,
		ncoreCategories: NcoreCategory[],
		ncoreCredentials?: NcoreCredentials,
	) {
		const torrents: TorrentSearchResult[] = [];

		try {
			const credentials = ncoreCredentials ?? this.getCredentials();

			const imdb = isImdbId(query) ? query : undefined;

			let page = 0;

			while (page <= 5) {
				page++;

				let torrentsOnPage = 0;

				const params = new URLSearchParams({
					oldal: page.toString(),
					tipus: "kivalasztottak_kozott",
					kivalasztott_tipus: ncoreCategories.join(","),
					mire: query,
					miben: imdb ? "imdb" : "name",
					miszerint: "ctime",
					hogyan: "DESC",
				});

				const link = `https://ncore.pro/torrents.php?${params.toString()}`;
				const torrentsPage = await this.session.fetch(link, credentials);
				if (!torrentsPage.ok) {
					throw new Error(`nCore search failed (${torrentsPage.status})`);
				}
				const $ = cheerio.load(await torrentsPage.text());

				const rssUrl = $("link[rel=alternate]").attr("href");
				const downloadKey = rssUrl?.split("=")[1];
				if (!downloadKey) throw new Error("Failed to get nCore download key");

				for (const el of $("div.box_torrent")) {
					torrentsOnPage++;

					const name = $(el).find("div.torrent_txt > a").attr("title");

					const categoryHref = $(el)
						.find("a > img.categ_link")
						.parent()
						.attr("href");

					const tracker = this.name;
					const category = this.parseCategory(categoryHref?.split("=")[1]);
					const size = parseSize($(el).find("div.box_meret2").text());
					const seeds = Number($(el).find("div.box_s2").text());
					const peers = Number($(el).find("div.box_l2").text());
					const torrentId = $(el).next().next().attr("id");
					const torrent = `https://ncore.pro/torrents.php?action=download&id=${torrentId}&key=${downloadKey}`;

					if (!name || !torrentId) continue;

					torrents.push(
						new TorrentSearchResult({
							name,
							imdb,
							tracker,
							category,
							size,
							seeds,
							peers,
							torrent,
							provider: this.id,
						}),
					);
				}

				if (torrentsOnPage < 50) break;
			}

			recordSearchSuccess(this.id, torrents.length);
		} catch (error) {
			logger.error(error);
			recordSearchFailure(this.id, error);
		}

		return torrents;
	}

	private getCredentials() {
		return requireCredentials(
			this.name,
			getRuntimeConfig().config.providers.ncore,
		);
	}

	private parseCategory(category: string | undefined) {
		if (!category) return undefined;

		return {
			[NcoreCategory.Film_SD_HU]: "Movies/SD/HU",
			[NcoreCategory.Film_SD_EN]: "Movies/SD/EN",
			[NcoreCategory.Film_HD_HU]: "Movies/HD/HU",
			[NcoreCategory.Film_HD_EN]: "Movies/HD/EN",
			[NcoreCategory.Sorozat_SD_HU]: "TV/SD/HU",
			[NcoreCategory.Sorozat_SD_EN]: "TV/SD/EN",
			[NcoreCategory.Sorozat_HD_HU]: "TV/HD/HU",
			[NcoreCategory.Sorozat_HD_EN]: "TV/HD/EN",
		}[category];
	}
}
