import type { StreamReference } from "./stream-reference";

export type MediaType = "movie" | "tv";

export interface CatalogTitle {
	id: number;
	media_type: MediaType;
	title?: string;
	name?: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	release_date?: string;
	first_air_date?: string;
	vote_average: number;
}

export interface TitleDetails extends CatalogTitle {
	imdb_id?: string | null;
	external_ids?: { imdb_id?: string | null };
	genres: { id: number; name: string }[];
	runtime?: number;
	seasons?: {
		season_number: number;
		name: string;
		episode_count: number;
		air_date?: string | null;
	}[];
}

export interface Episode {
	id: number;
	episode_number: number;
	name: string;
	overview: string;
	runtime: number | null;
	air_date: string | null;
	still_path: string | null;
	vote_average?: number;
}

export interface CatalogResults {
	results: CatalogTitle[];
	page: number;
	total_pages: number;
}

// TMDB dates have no time zone or release time. Wait until the next UTC day.
export function releaseCutoffDate(now = Date.now()) {
	return new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isReleased(date: string | null | undefined, cutoff: string) {
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const parsed = new Date(`${date}T00:00:00Z`);
	return (
		!Number.isNaN(parsed.getTime()) &&
		parsed.toISOString().slice(0, 10) === date &&
		date <= cutoff
	);
}

export function titleName(title: CatalogTitle) {
	return title.title || title.name || "Untitled";
}

export function titleYear(title: CatalogTitle) {
	return (title.release_date || title.first_air_date || "").slice(0, 4);
}

export function imageUrl(path: string | null, size = "w500") {
	return path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
}

export async function fetchCatalog<T>(url: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(
			body?.error || "Could not load this page. Please try again.",
		);
	}
	return response.json();
}

export function episodeAirDate(date: string | null) {
	if (!date) return "Air date TBA";
	const parsed = new Date(`${date}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return "Air date TBA";
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(parsed);
}

export interface SeasonDetails {
	stream_reference?: StreamReference;
	episodes: Episode[];
}
