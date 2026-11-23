import type { MediaType } from "./catalog";

const SORTS = ["trending", "popular", "rating", "newest", "oldest"] as const;

export type CatalogRequest = {
	type: "all" | MediaType;
	id: string | null;
	season: string | null;
	page: string;
	genre: string;
	year: string;
	sort: (typeof SORTS)[number];
	/** List the genres of `type` instead of titles. */
	genres: boolean;
	query: string;
	language: "en" | "hu";
};

/** Returns null when the query string is not a valid catalog request. */
export function parseCatalogRequest(
	params: URLSearchParams,
	currentYear = new Date().getFullYear(),
): CatalogRequest | null {
	const type = params.get("type") || "all";
	const id = params.get("id");
	const season = params.get("season");
	const page = params.get("page") || "1";
	const genre = params.get("genre") || "";
	const year = params.get("year") || "";
	const sort = params.get("sort") || "trending";
	const genres = params.get("genres") === "1";
	const query = (params.get("q") || "").trim();

	const validType = type === "all" || type === "movie" || type === "tv";
	const validPage =
		/^\d+$/.test(page) && Number(page) >= 1 && Number(page) <= 500;
	const validId = id === null || (/^[1-9]\d*$/.test(id) && type !== "all");
	const validSeason =
		season === null || (/^\d+$/.test(season) && !!id && type === "tv");
	const validGenre = genre === "" || /^[1-9]\d*$/.test(genre);
	const validYear =
		year === "" ||
		(/^\d{4}$/.test(year) &&
			Number(year) >= 1900 &&
			Number(year) <= currentYear + 1);
	const validSort = (SORTS as readonly string[]).includes(sort);
	// Genres and discover filters only exist per media type.
	const needsMediaType = genres || genre || year || sort !== "trending";

	if (
		!validType ||
		!validPage ||
		!validId ||
		!validSeason ||
		query.length > 200 ||
		!validGenre ||
		!validYear ||
		!validSort ||
		(needsMediaType && type === "all")
	)
		return null;

	return {
		type: type as CatalogRequest["type"],
		id,
		season,
		page,
		genre,
		year,
		sort: sort as CatalogRequest["sort"],
		genres,
		query,
		language: params.get("language") === "hu" ? "hu" : "en",
	};
}

function tmdbPath({ type, id, season, genres, query, sort }: CatalogRequest) {
	if (genres) return `genre/${type}/list`;
	if (id) return `${type}/${id}${season !== null ? `/season/${season}` : ""}`;
	if (query) return `search/${type === "all" ? "multi" : type}`;
	if (sort === "trending") return `trending/${type}/week`;
	return `discover/${type}`;
}

/** Query parameters of TMDB's discover endpoint (sorted, filtered browsing). */
function discoverParams(
	{ type, sort, genre, year }: CatalogRequest,
	cutoff: string,
): Record<string, string> {
	const dateField = type === "tv" ? "first_air_date" : "primary_release_date";
	const sortBy = {
		popular: "popularity.desc",
		rating: "vote_average.desc",
		newest: `${dateField}.desc`,
		oldest: `${dateField}.asc`,
	}[sort as Exclude<CatalogRequest["sort"], "trending">];
	const yearField =
		type === "tv" ? "first_air_date_year" : "primary_release_year";
	return {
		sort_by: sortBy,
		...(genre ? { with_genres: genre } : {}),
		...(year ? { [yearField]: year } : {}),
		...(sort === "rating" ? { "vote_count.gte": "200" } : {}),
		[`${dateField}.lte`]: cutoff,
	};
}

export function buildTmdbUrl(
	request: CatalogRequest,
	apiKey: string,
	cutoff: string,
) {
	const { type, id, season, genres, query, sort } = request;
	const isTitleDetails = !!id && season === null;
	const isDiscover =
		!id && !query && !genres && type !== "all" && sort !== "trending";
	const url = new URL(`https://api.themoviedb.org/3/${tmdbPath(request)}`);
	url.search = new URLSearchParams({
		api_key: apiKey,
		language: request.language,
		include_adult: "false",
		page: request.page,
		...(query ? { query } : {}),
		...(isTitleDetails ? { append_to_response: "external_ids" } : {}),
		...(isDiscover ? discoverParams(request, cutoff) : {}),
	}).toString();
	return url;
}
