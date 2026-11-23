"use client";

import { Film, Layers, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/i18n";
import {
	type Episode,
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
import { LoadError } from "./load-state";
import {
	StreamHeadingSkeleton,
	StreamListSkeleton,
	StreamPicker,
} from "./stream-picker";

const heroClass =
	"grid grid-cols-1 gap-6 pt-16 md:min-h-[32rem] md:grid-cols-[12rem_minmax(0,1fr)] md:items-end md:gap-x-8 md:pt-24 lg:grid-cols-[14rem_minmax(0,1fr)]";
const posterClass = "mx-auto w-48 rounded-lg sm:w-52 md:mx-0 md:w-full";
const sectionClass = "space-y-6";
const episodesHeaderClass = "flex items-center justify-between gap-4";
const episodeGridClass =
	"grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
const episodeCardClass =
	"flex min-w-0 flex-col overflow-hidden rounded-xl border shadow-xs";

/**
 * Placeholder for a whole title page: the poster and details, followed by the
 * section the title's type opens with (episodes of a show, streams of a movie).
 */
function TitleSkeleton({ type }: { type: MediaType }) {
	return (
		<>
			<section aria-hidden="true" className="relative isolate">
				<div className={heroClass}>
					<Skeleton className={`${posterClass} aspect-[2/3]`} />
					<div className="min-w-0 flex-1">
						<div className="flex h-8 items-center sm:h-10">
							<Skeleton className="h-6 w-2/3 max-w-md sm:h-8" />
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							{["w-12", "w-12", "w-16", "w-20", "w-16"].map((width, i) => (
								<Skeleton
									// biome-ignore lint/suspicious/noArrayIndexKey: Static placeholders.
									key={i}
									className={`h-5 rounded-4xl ${width}`}
								/>
							))}
						</div>
						<div className="mt-6 max-w-3xl">
							{["w-full", "w-full", "w-full", "w-3/5"].map((width, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: Static placeholders.
								<div key={i} className="flex h-7 items-center">
									<Skeleton className={`h-3.5 ${width}`} />
								</div>
							))}
						</div>
					</div>
				</div>
			</section>
			<section aria-hidden="true" className={sectionClass}>
				{type === "tv" ? (
					<>
						<div className={episodesHeaderClass}>
							<Skeleton className="h-6 w-24" />
							<Skeleton className="h-11 w-36 rounded-full" />
						</div>
						<EpisodeGridSkeleton count={12} />
					</>
				) : (
					<>
						<StreamHeadingSkeleton />
						<StreamListSkeleton />
					</>
				)}
			</section>
		</>
	);
}

/** Placeholder episode cards: a still, the name, the air date and two synopsis lines. */
function EpisodeGridSkeleton({ count }: { count: number }) {
	return (
		<div aria-hidden="true" className={episodeGridClass}>
			{Array.from({ length: count }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: Static placeholders.
				<div key={i} className={`${episodeCardClass} bg-card`}>
					<Skeleton className="aspect-video w-full rounded-none" />
					<div className="min-w-0 flex-1 p-4">
						<div className="flex h-6 items-center">
							<Skeleton className="h-4 w-2/3" />
						</div>
						<div className="mt-1 flex h-4 items-center">
							<Skeleton className="h-3 w-1/3" />
						</div>
						<div className="mt-2 flex h-6 items-center">
							<Skeleton className="h-3.5 w-full" />
						</div>
						<div className="flex h-6 items-center">
							<Skeleton className="h-3.5 w-4/5" />
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

export function TitleView({ type, id }: { type: MediaType; id: string }) {
	const { language } = useLanguage();
	const {
		data: title,
		error,
		mutate,
	} = useSWR<TitleDetails>(
		`/api/catalog?type=${type}&id=${id}&language=${language}`,
		fetchCatalog,
		{
			revalidateOnFocus: false,
			shouldRetryOnError: false,
		},
	);
	return (
		<div className="space-y-6">
			{error ? (
				<LoadError error={error} retry={() => mutate()} />
			) : !title ? (
				<TitleSkeleton type={type} />
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
	const { t, language } = useLanguage();
	const seasons = (title.seasons || []).filter(
		(season) => season.episode_count > 0,
	);
	seasons.sort((a, b) => a.season_number - b.season_number);
	const [season, setSeason] = useState(() => seasons.at(-1)?.season_number);
	const streamsRef = useRef<HTMLElement>(null);
	const [episode, setEpisode] = useState<Episode | null>(null);
	const episodes = useSWR<SeasonDetails>(
		type === "tv" && season !== undefined
			? `/api/catalog?type=tv&id=${title.id}&season=${season}&language=${language}`
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
				<div className={heroClass}>
					{title.poster_path ? (
						/* biome-ignore lint/performance/noImgElement: TMDB serves optimized poster sizes. */ <img
							src={imageUrl(title.poster_path, "w342")}
							alt=""
							className={`${posterClass} aspect-[2/3] border object-cover shadow-xl`}
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
									{t("{minutes} min", { minutes: title.runtime })}
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
							{title.overview || t("No synopsis available yet.")}
						</p>
					</div>
				</div>
			</section>
			{type === "tv" && (
				<section className={sectionClass}>
					{!seasons.length ? (
						<p className="py-6 text-muted-foreground">
							{t("No episodes are available yet.")}
						</p>
					) : (
						<>
							<div className={episodesHeaderClass}>
								<div className="flex items-center gap-3">
									<h2 className="text-xl font-semibold">{t("Episodes")}</h2>
									{episodes.data && (
										<Badge
											variant="secondary"
											aria-label={t("{count} episodes", {
												count: episodes.data.episodes.length,
											})}
										>
											{episodes.data.episodes.length}
										</Badge>
									)}
								</div>
								<FilterSelect
									icon={Layers}
									aria-label={t("Season")}
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
								<EpisodeGridSkeleton
									count={
										seasons.find((item) => item.season_number === season)
											?.episode_count || 12
									}
								/>
							) : !episodes.data.episodes.length ? (
								<p className="py-6 text-muted-foreground">
									{t("No episodes in this season yet.")}
								</p>
							) : (
								<div key={season} className={episodeGridClass}>
									{[...episodes.data.episodes]
										.sort((a, b) => a.episode_number - b.episode_number)
										.map((item) => (
											<button
												type="button"
												key={item.id}
												aria-pressed={episode?.id === item.id}
												title={item.overview || t("No synopsis available.")}
												onClick={() => setEpisode({ ...item })}
												className={`group ${episodeCardClass} text-left transition hover:border-foreground/30 ${episode?.id === item.id ? "border-foreground/40 bg-accent" : "bg-card"}`}
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
														{t("Episode {number}", {
															number: item.episode_number,
														})}
													</Badge>
													{typeof item.vote_average === "number" &&
														item.vote_average > 0 && (
															<Badge
																variant="secondary"
																className="absolute bottom-3 right-3 bg-black/75 text-white"
																aria-label={t("Rating {rating} out of 10", {
																	rating: item.vote_average.toFixed(1),
																})}
															>
																<Star className="size-3 fill-amber-300 text-amber-300" />
																{item.vote_average.toFixed(1)}
															</Badge>
														)}
												</span>
												<span className="block min-w-0 flex-1 p-4">
													<span className="block font-medium">{item.name}</span>
													<span className="mt-1 block text-xs text-muted-foreground">
														{formatDate(item.air_date, language) ||
															t("Air date TBA")}
														{item.runtime
															? ` · ${t("{minutes} min", { minutes: item.runtime })}`
															: ""}
													</span>
													<span className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
														{item.overview || t("No synopsis available.")}
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
					aria-label={t("Streams")}
				>
					<StreamPicker
						key={streamId}
						imdbId={imdbId}
						data={streams.data}
						error={streams.error}
						retry={() => streams.mutate()}
						title={
							episode
								? `${titleName(title)}${titleYear(title) ? ` (${titleYear(title)})` : ""} · S${season} E${episode.episode_number} · ${episodes.data?.episodes.find((item) => item.id === episode.id)?.name || episode.name}`
								: `${titleName(title)}${titleYear(title) ? ` (${titleYear(title)})` : ""}`
						}
					/>
				</section>
			)}
		</>
	);
}
