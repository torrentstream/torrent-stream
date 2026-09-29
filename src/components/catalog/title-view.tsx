"use client";

import { Film, Layers, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import {
	type Episode,
	episodeAirDate,
	fetchCatalog,
	imageUrl,
	type MediaType,
	type SeasonDetails,
	type TitleDetails,
	titleName,
	titleYear,
} from "@/lib/media/catalog";
import type { StremioStream } from "@/lib/search/stremio";
import { FilterSelect } from "./filter-select";
import { LoadError, Loading } from "./load-state";
import { StreamPicker } from "./stream-picker";

export function TitleView({ type, id }: { type: MediaType; id: string }) {
	const {
		data: title,
		error,
		mutate,
	} = useSWR<TitleDetails>(`/api/catalog?type=${type}&id=${id}`, fetchCatalog, {
		revalidateOnFocus: false,
		shouldRetryOnError: false,
	});
	return (
		<div className="space-y-6">
			{error ? (
				<LoadError error={error} retry={() => mutate()} />
			) : !title ? (
				<Loading>Loading title…</Loading>
			) : (
				<TitleContent title={title} type={type} />
			)}
		</div>
	);
}

function TitleContent({
	title,
	type,
}: {
	title: TitleDetails;
	type: MediaType;
}) {
	const seasons = (title.seasons || []).filter(
		(season) => season.episode_count > 0,
	);
	seasons.sort((a, b) => a.season_number - b.season_number);
	const [season, setSeason] = useState(() => seasons.at(-1)?.season_number);
	const streamsRef = useRef<HTMLElement>(null);
	const [episode, setEpisode] = useState<Episode | null>(null);
	const episodes = useSWR<SeasonDetails>(
		type === "tv" && season !== undefined
			? `/api/catalog?type=tv&id=${title.id}&season=${season}`
			: null,
		fetchCatalog,
		{ revalidateOnFocus: false, shouldRetryOnError: false },
	);

	const imdbId =
		episodes.data?.stream_reference?.imdbId ||
		title.imdb_id ||
		title.external_ids?.imdb_id;
	const streamSeason =
		season === undefined
			? undefined
			: (episodes.data?.stream_reference?.seasons?.[season] ?? season);
	const streamId =
		imdbId && (type === "movie" || episode)
			? `${imdbId}${type === "tv" ? `:${streamSeason}:${episode?.episode_number}` : ""}`
			: null;
	const streams = useSWR<{ streams: StremioStream[] }>(
		streamId
			? `/api/stream/${type === "tv" ? "series" : "movie"}/${streamId}.json`
			: null,
		fetchCatalog,
		{
			revalidateOnFocus: false,
			revalidateOnReconnect: false,
			shouldRetryOnError: false,
		},
	);
	useEffect(() => {
		if (episode && (streams.data || streams.error || streams.isLoading))
			streamsRef.current?.scrollIntoView({
				behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
					? "instant"
					: "smooth",
				block: "start",
			});
	}, [episode, streams.data, streams.error, streams.isLoading]);

	return (
		<>
			<section className="relative isolate">
				{title.backdrop_path && (
					<div className="pointer-events-none absolute -top-4 -bottom-20 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden [mask-image:linear-gradient(to_bottom,black_0%,black_40%,transparent_100%)] sm:-top-6">
						{/* biome-ignore lint/performance/noImgElement: TMDB serves optimized backdrop sizes. */}
						<img
							src={imageUrl(title.backdrop_path, "w1280")}
							alt=""
							className="absolute inset-0 size-full object-cover object-center opacity-60"
						/>
						<div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/50 to-background/20" />
					</div>
				)}
				<div className="grid grid-cols-1 gap-6 pt-16 md:min-h-[32rem] md:grid-cols-[12rem_minmax(0,1fr)] md:items-end md:gap-x-8 md:pt-24 lg:grid-cols-[14rem_minmax(0,1fr)]">
					{title.poster_path ? (
						/* biome-ignore lint/performance/noImgElement: TMDB serves optimized poster sizes. */ <img
							src={imageUrl(title.poster_path, "w342")}
							alt=""
							className="mx-auto w-48 rounded-lg border shadow-xl sm:w-52 md:mx-0 md:w-full"
						/>
					) : (
						<Film className="mx-auto size-20 text-muted-foreground md:mx-0" />
					)}
					<div className="min-w-0 flex-1">
						<h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
							{titleName(title)}
						</h1>
						<div className="mt-4 flex flex-wrap gap-2">
							{titleYear(title) && (
								<Badge variant="outline" className="bg-background/20">
									{titleYear(title)}
								</Badge>
							)}
							{title.vote_average > 0 && (
								<Badge variant="outline" className="bg-background/20">
									<Star className="text-amber-400" />
									{title.vote_average.toFixed(1)}
								</Badge>
							)}
							{title.runtime ? (
								<Badge variant="outline" className="bg-background/20">
									{title.runtime} min
								</Badge>
							) : null}
							{title.genres.map((genre) => (
								<Badge
									key={genre.id}
									variant="outline"
									className="bg-background/20"
								>
									{genre.name}
								</Badge>
							))}
						</div>
						<p className="mt-6 max-w-3xl text-sm leading-7 text-foreground/80">
							{title.overview || "No synopsis available yet."}
						</p>
					</div>
				</div>
			</section>
			{type === "tv" && (
				<section className="space-y-6">
					{!seasons.length ? (
						<p className="py-6 text-muted-foreground">
							No episodes are available yet.
						</p>
					) : (
						<>
							<div className="flex items-center justify-between gap-4">
								<div className="flex items-center gap-3">
									<h2 className="text-xl font-semibold">Episodes</h2>
									{episodes.data && (
										<Badge
											variant="secondary"
											aria-label={`${episodes.data.episodes.length} episodes`}
										>
											{episodes.data.episodes.length}
										</Badge>
									)}
								</div>
								<FilterSelect
									icon={Layers}
									aria-label="Season"
									value={season}
									onChange={(event) => {
										setSeason(Number(event.target.value));
										setEpisode(null);
									}}
								>
									{seasons.map((item) => (
										<option key={item.season_number} value={item.season_number}>
											{item.name}
										</option>
									))}
								</FilterSelect>
							</div>
							{episodes.error ? (
								<LoadError
									error={episodes.error}
									retry={() => episodes.mutate()}
								/>
							) : !episodes.data ? (
								<Loading>Loading episodes…</Loading>
							) : !episodes.data.episodes.length ? (
								<p className="py-6 text-muted-foreground">
									No episodes in this season yet.
								</p>
							) : (
								<div
									key={season}
									className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
								>
									{[...episodes.data.episodes]
										.sort((a, b) => a.episode_number - b.episode_number)
										.map((item) => (
											<button
												type="button"
												key={item.id}
												aria-pressed={episode?.id === item.id}
												title={item.overview || "No synopsis available."}
												onClick={() => setEpisode({ ...item })}
												className={`group flex min-w-0 flex-col overflow-hidden rounded-xl border text-left shadow-xs transition hover:border-foreground/30 ${episode?.id === item.id ? "border-foreground/40 bg-accent" : "bg-card"}`}
											>
												<span className="relative block aspect-video w-full overflow-hidden bg-secondary">
													{item.still_path ? (
														/* biome-ignore lint/performance/noImgElement: TMDB serves optimized episode stills. */ <img
															src={imageUrl(item.still_path, "w500")}
															alt=""
															loading="lazy"
															className="size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
														/>
													) : (
														<Film className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
													)}
													<Badge
														variant="secondary"
														className="absolute bottom-3 left-3 bg-black/75 text-white"
													>
														Episode {item.episode_number}
													</Badge>
													{typeof item.vote_average === "number" &&
														item.vote_average > 0 && (
															<Badge
																variant="secondary"
																className="absolute bottom-3 right-3 bg-black/75 text-white"
																aria-label={`Rating ${item.vote_average.toFixed(1)} out of 10`}
															>
																<Star className="size-3 fill-amber-300 text-amber-300" />
																{item.vote_average.toFixed(1)}
															</Badge>
														)}
												</span>
												<span className="block min-w-0 flex-1 p-4">
													<span className="block font-medium">{item.name}</span>
													<span className="mt-1 block text-xs text-muted-foreground">
														{episodeAirDate(item.air_date)}
														{item.runtime ? ` · ${item.runtime} min` : ""}
													</span>
													<span className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
														{item.overview || "No synopsis available."}
													</span>
												</span>
											</button>
										))}
								</div>
							)}
						</>
					)}
				</section>
			)}
			{(type === "movie" || episode) && (
				<section
					ref={streamsRef}
					className="space-y-6 scroll-mt-24"
					aria-label="Streams"
				>
					<StreamPicker
						key={streamId}
						imdbId={imdbId}
						data={streams.data}
						error={streams.error}
						retry={() => streams.mutate()}
						title={
							episode
								? `${titleName(title)}${titleYear(title) ? ` (${titleYear(title)})` : ""} · S${season} E${episode.episode_number} · ${episode.name}`
								: `${titleName(title)}${titleYear(title) ? ` (${titleYear(title)})` : ""}`
						}
						poster={imageUrl(title.backdrop_path, "w1280")}
					/>
				</section>
			)}
		</>
	);
}
