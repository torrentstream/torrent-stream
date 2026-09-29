import { type NextRequest, NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config/runtime";
import {
	type CatalogResults,
	type Episode,
	isReleased,
	releaseCutoffDate,
	type TitleDetails,
} from "@/lib/media/catalog";
import { resolveSeriesStreamReference } from "@/lib/media/stream-reference";

// Used when no personal API key is saved in Settings.
const DEFAULT_TMDB_API_KEY = "a4d9ad8d2d072c50dc998cc0d1a508fa";

export async function GET(request: NextRequest) {
	const params = request.nextUrl.searchParams;
	const type = params.get("type") || "all";
	const id = params.get("id");
	const season = params.get("season");
	const page = params.get("page") || "1";
	const genre = params.get("genre") || "";
	const year = params.get("year") || "";
	const sort = params.get("sort") || "trending";
	const genres = params.get("genres") === "1";
	const query = (params.get("q") || "").trim();

	if (
		!["all", "movie", "tv"].includes(type) ||
		!/^\d+$/.test(page) ||
		Number(page) < 1 ||
		Number(page) > 500 ||
		(id !== null && (!/^[1-9]\d*$/.test(id) || type === "all")) ||
		(season !== null && (!/^\d+$/.test(season) || !id || type !== "tv")) ||
		query.length > 200 ||
		(genre !== "" && !/^[1-9]\d*$/.test(genre)) ||
		(year !== "" &&
			(!/^\d{4}$/.test(year) ||
				Number(year) < 1900 ||
				Number(year) > new Date().getFullYear() + 1)) ||
		!["trending", "popular", "rating", "newest", "oldest"].includes(sort) ||
		((genres || genre || year || sort !== "trending") && type === "all")
	) {
		return NextResponse.json(
			{ error: "Invalid catalog request." },
			{ status: 400 },
		);
	}

	const key = getRuntimeConfig().config.tmdbApiKey || DEFAULT_TMDB_API_KEY;

	const cutoff = releaseCutoffDate();
	const path = genres
		? `genre/${type}/list`
		: id
			? `${type}/${id}${season !== null ? `/season/${season}` : ""}`
			: query
				? `search/${type === "all" ? "multi" : type}`
				: sort === "trending"
					? `trending/${type}/week`
					: `discover/${type}`;
	const url = new URL(`https://api.themoviedb.org/3/${path}`);
	url.search = new URLSearchParams({
		api_key: key,
		language: "en-US",
		include_adult: "false",
		page,
		...(query ? { query } : {}),
		...(id && season === null ? { append_to_response: "external_ids" } : {}),
		...(!id && !query && !genres && type !== "all" && sort !== "trending"
			? {
					sort_by:
						sort === "popular"
							? "popularity.desc"
							: sort === "rating"
								? "vote_average.desc"
								: `${type === "tv" ? "first_air_date" : "primary_release_date"}.${sort === "oldest" ? "asc" : "desc"}`,
					...(genre ? { with_genres: genre } : {}),
					...(year
						? {
								[type === "tv"
									? "first_air_date_year"
									: "primary_release_year"]: year,
							}
						: {}),
					...(sort === "rating" ? { "vote_count.gte": "200" } : {}),
					[type === "tv" ? "first_air_date.lte" : "primary_release_date.lte"]:
						cutoff,
				}
			: {}),
	}).toString();

	try {
		const response = await fetch(url, {
			next: { revalidate: 900 },
			signal: AbortSignal.timeout(10000),
		});
		if (!response.ok) {
			return NextResponse.json(
				{
					error:
						response.status === 404
							? "This title could not be found."
							: "The movie catalog is temporarily unavailable. Please try again.",
				},
				{ status: response.status === 404 ? 404 : 502 },
			);
		}
		const data = await response.json();
		if (genres) return NextResponse.json(data);
		if (id) {
			if (season === null) {
				if (
					!isReleased(
						type === "tv" ? data.first_air_date : data.release_date,
						cutoff,
					)
				) {
					return NextResponse.json(
						{
							error:
								"This title is not available yet. Titles appear one day after their release date.",
						},
						{ status: 404 },
					);
				}
				if (type === "tv")
					data.seasons = (data.seasons || []).filter(
						(item: NonNullable<TitleDetails["seasons"]>[number]) =>
							item.episode_count > 0 && isReleased(item.air_date, cutoff),
					);
			}
			if (type === "tv" && season !== null) {
				try {
					const parentUrl = new URL(url);
					parentUrl.pathname = `/3/tv/${id}`;
					parentUrl.searchParams.set("append_to_response", "external_ids");
					const response = await fetch(parentUrl, {
						next: { revalidate: 900 },
						signal: AbortSignal.timeout(8000),
					});
					if (response.ok) {
						const parent = await response.json();
						if (!parent.imdb_id && !parent.external_ids?.imdb_id) {
							data.stream_reference = await resolveSeriesStreamReference(
								parent.original_name || parent.name,
								Number(season),
								data.episodes || [],
							);
						}
					}
				} catch {
					/* Optional enrichment must not prevent episode browsing. */
				}
			}
			if (season !== null)
				data.episodes = (data.episodes || []).filter((episode: Episode) =>
					isReleased(episode.air_date, cutoff),
				);
			return NextResponse.json({ ...data, media_type: type });
		}

		const catalog = data as CatalogResults;
		return NextResponse.json({
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
		});
	} catch {
		return NextResponse.json(
			{ error: "Could not reach the movie catalog. Please try again." },
			{ status: 502 },
		);
	}
}
