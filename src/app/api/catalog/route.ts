import { type NextRequest, NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config/runtime";
import {
	type CatalogResults,
	type Episode,
	isReleased,
	releaseCutoffDate,
	type TitleDetails,
} from "@/lib/media/catalog";
import {
	applyEnglishFallback,
	needsEnglishFallback,
} from "@/lib/media/metadata-language";
import {
	resolveSeriesStreamReference,
	type StreamReference,
} from "@/lib/media/stream-reference";
import {
	buildTmdbUrl,
	type CatalogRequest,
	parseCatalogRequest,
} from "@/lib/media/tmdb";

// Used when no personal API key is saved in Settings.
const DEFAULT_TMDB_API_KEY = "a4d9ad8d2d072c50dc998cc0d1a508fa";

const errorResponse = (error: string, status: number) =>
	NextResponse.json({ error }, { status });

const fetchTmdb = (url: URL, timeout = 10000) =>
	fetch(url, {
		next: { revalidate: 900 },
		signal: AbortSignal.timeout(timeout),
	});

export async function GET(request: NextRequest) {
	const catalogRequest = parseCatalogRequest(request.nextUrl.searchParams);
	if (!catalogRequest) return errorResponse("Invalid catalog request.", 400);
	const { type, id, season, genres, language } = catalogRequest;

	const key = getRuntimeConfig().config.tmdbApiKey || DEFAULT_TMDB_API_KEY;
	const cutoff = releaseCutoffDate();
	const url = buildTmdbUrl(catalogRequest, key, cutoff);

	try {
		const response = await fetchTmdb(url);
		if (!response.ok) {
			return response.status === 404
				? errorResponse("This title could not be found.", 404)
				: errorResponse(
						"The movie catalog is temporarily unavailable. Please try again.",
						502,
					);
		}
		const data = await response.json();
		if (language !== "en") await fillMissingFromEnglish(data, url, language);

		if (genres) return NextResponse.json(data);
		if (!id) return NextResponse.json(releasedTitles(data, type, cutoff));
		if (season !== null) {
			await addStreamReference(data, url, id, season);
			data.episodes = (data.episodes || []).filter((episode: Episode) =>
				isReleased(episode.air_date, cutoff),
			);
			return NextResponse.json({ ...data, media_type: type });
		}
		if (
			!isReleased(
				type === "tv" ? data.first_air_date : data.release_date,
				cutoff,
			)
		) {
			return errorResponse(
				"This title is not available yet. Titles appear one day after their release date.",
				404,
			);
		}
		if (type === "tv")
			data.seasons = (data.seasons || []).filter(
				(item: NonNullable<TitleDetails["seasons"]>[number]) =>
					item.episode_count > 0 && isReleased(item.air_date, cutoff),
			);
		return NextResponse.json({ ...data, media_type: type });
	} catch {
		return errorResponse(
			"Could not reach the movie catalog. Please try again.",
			502,
		);
	}
}

/** Fills fields TMDB has no translation for from the English response. */
async function fillMissingFromEnglish(
	data: Record<string, unknown>,
	url: URL,
	language: CatalogRequest["language"],
) {
	if (!needsEnglishFallback(data, language)) return;
	try {
		const englishUrl = new URL(url);
		englishUrl.searchParams.set("language", "en");
		const response = await fetchTmdb(englishUrl);
		if (response.ok)
			applyEnglishFallback(data, await response.json(), language);
	} catch {
		/* Keep localized metadata available when English enrichment fails. */
	}
}

/** Series without an IMDb id need another reference to look up streams. */
async function addStreamReference(
	data: { episodes?: Episode[]; stream_reference?: StreamReference },
	seasonUrl: URL,
	id: string,
	season: string,
) {
	try {
		const parentUrl = new URL(seasonUrl);
		parentUrl.pathname = `/3/tv/${id}`;
		parentUrl.searchParams.set("append_to_response", "external_ids");
		const response = await fetchTmdb(parentUrl, 8000);
		if (!response.ok) return;
		const parent = await response.json();
		if (parent.imdb_id || parent.external_ids?.imdb_id) return;
		data.stream_reference = await resolveSeriesStreamReference(
			parent.original_name || parent.name,
			Number(season),
			data.episodes || [],
		);
	} catch {
		/* Optional enrichment must not prevent episode browsing. */
	}
}

/** A list page limited to released movies and series. */
function releasedTitles(
	catalog: CatalogResults,
	type: CatalogRequest["type"],
	cutoff: string,
) {
	return {
		page: catalog.page,
		total_pages: Math.min(catalog.total_pages, 500),
		results: catalog.results
			.filter(
				(item) => type !== "all" || ["movie", "tv"].includes(item.media_type),
			)
			.map((item) => ({ ...item, media_type: item.media_type || type }))
			.filter((item) =>
				isReleased(
					item.media_type === "tv" ? item.first_air_date : item.release_date,
					cutoff,
				),
			),
	};
}
