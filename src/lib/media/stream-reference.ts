import type { Episode } from "./catalog";

export interface StreamReference {
	imdbId: string;
	seasons?: Record<number, number>;
}
interface CatalogEpisode {
	season: number;
	episode: number;
	name?: string;
	released?: string;
}
const normalize = (value: string) =>
	value
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]/gu, "");
async function getCatalog<T>(path: string): Promise<T | undefined> {
	try {
		const response = await fetch(`https://v3-cinemeta.strem.io/${path}`, {
			next: { revalidate: 900 },
			signal: AbortSignal.timeout(8000),
		});
		return response.ok ? await response.json() : undefined;
	} catch {
		return undefined;
	}
}
export async function resolveSeriesStreamReference(
	name: string,
	season: number,
	episodes: Episode[],
): Promise<StreamReference | undefined> {
	if (
		episodes.length < 2 ||
		episodes.some((episode) => !episode.name || !episode.air_date)
	)
		return;
	const search = await getCatalog<{ metas: { id: string }[] }>(
		`catalog/series/top/search=${encodeURIComponent(name)}.json`,
	);
	const imdbId = (search?.metas || [])
		.map((item) => item.id)
		.find((id) => /^tt\d+$/.test(id));
	if (!imdbId) return;
	const result = await getCatalog<{
		meta: { videos?: CatalogEpisode[] };
	}>(`meta/series/${imdbId}.json`);
	const videos = result?.meta?.videos || [];
	const matches = [...new Set(videos.map((video) => video.season))]
		.filter(
			(number) =>
				number > 0 &&
				episodes.every((episode) =>
					videos.some(
						(video) =>
							video.season === number &&
							video.episode === episode.episode_number &&
							normalize(video.name || "") === normalize(episode.name) &&
							video.released?.slice(0, 10) === episode.air_date,
					),
				),
		)
		.map((number) => ({ imdbId, seasons: { [season]: number } }));
	return matches.length === 1 ? matches[0] : undefined;
}
