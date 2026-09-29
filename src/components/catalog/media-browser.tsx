"use client";

import {
	ArrowDownWideNarrow,
	Calendar,
	Film,
	Layers,
	Star,
	Tags,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { Badge } from "@/components/ui/badge";
import {
	type CatalogResults,
	fetchCatalog,
	imageUrl,
	titleName,
	titleYear,
} from "@/lib/media/catalog";
import { BrowseSearch } from "./browse-search";
import { FilterSelect } from "./filter-select";
import { LoadError, Loading } from "./load-state";

export function MediaBrowser() {
	const params = useSearchParams();
	const query = params.get("q") || "";
	const type = ["movie", "tv"].includes(params.get("type") || "")
		? params.get("type") || "all"
		: "all";
	const genre = params.get("genre") || "";
	const year = params.get("year") || "";
	const sort = type === "all" ? "trending" : params.get("sort") || "trending";
	const discovery = !query && type !== "all" && sort !== "trending";
	const { data: genres } = useSWR<{ genres: { id: number; name: string }[] }>(
		type !== "all" ? `/api/catalog?type=${type}&genres=1` : null,
		fetchCatalog,
	);
	const filters = new URLSearchParams({
		type,
		q: query,
		...(!query ? { sort, ...(discovery ? { genre, year } : {}) } : {}),
	}).toString();
	function navigate(values: Record<string, string>) {
		const next = new URLSearchParams(window.location.search);
		for (const [key, value] of Object.entries(values)) {
			if (value) next.set(key, value);
			else next.delete(key);
		}
		window.history.pushState(null, "", `/?${next}`);
	}
	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<BrowseSearch query={query} onSearch={(q) => navigate({ q })} />
				<div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:w-auto xl:shrink-0">
					<FilterSelect
						icon={Tags}
						aria-label="Genre"
						disabled={!discovery}
						title={
							!discovery
								? "Choose Movies or TV shows and a non-trending sort to filter by genre or year."
								: undefined
						}
						value={discovery ? genre : ""}
						onChange={(e) => navigate({ genre: e.target.value })}
					>
						<option value="">All genres</option>
						{genres?.genres.map((g) => (
							<option key={g.id} value={g.id}>
								{g.name}
							</option>
						))}
					</FilterSelect>
					<FilterSelect
						icon={Calendar}
						aria-label="Year"
						disabled={!discovery}
						title={
							!discovery
								? "Choose Movies or TV shows and a non-trending sort to filter by genre or year."
								: undefined
						}
						value={discovery ? year : ""}
						onChange={(e) => navigate({ year: e.target.value })}
					>
						<option value="">All years</option>
						{Array.from(
							{ length: new Date().getFullYear() - 1899 },
							(_, i) => new Date().getFullYear() - i,
						).map((y) => (
							<option key={y} value={y}>
								{y}
							</option>
						))}
					</FilterSelect>
					<FilterSelect
						icon={Layers}
						aria-label="Type"
						value={type}
						onChange={(e) =>
							navigate({
								type: e.target.value,
								genre: "",
								...(e.target.value === "all"
									? { sort: "trending", year: "" }
									: {}),
							})
						}
					>
						<option value="all">All titles</option>
						<option value="movie">Movies</option>
						<option value="tv">TV shows</option>
					</FilterSelect>
					<FilterSelect
						icon={ArrowDownWideNarrow}
						aria-label="Sort"
						disabled={!!query}
						value={query ? "relevance" : sort}
						onChange={(e) =>
							navigate({
								sort: e.target.value,
								...(e.target.value === "trending"
									? { genre: "", year: "" }
									: {}),
							})
						}
					>
						{query && <option value="relevance">Relevance</option>}
						<option value="trending">Trending</option>
						<option disabled={type === "all"} value="popular">
							Popular
						</option>
						<option disabled={type === "all"} value="rating">
							Top rated
						</option>
						<option disabled={type === "all"} value="newest">
							Newest
						</option>
						<option disabled={type === "all"} value="oldest">
							Oldest
						</option>
					</FilterSelect>
				</div>
			</header>
			<TitleGrid key={filters} filters={filters} />
		</div>
	);
}

function TitleGrid({ filters }: { filters: string }) {
	const gridRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const [columns, setColumns] = useState(2);
	const { data, error, size, setSize, isLoading, isValidating, mutate } =
		useSWRInfinite<CatalogResults>(
			(index, previous: CatalogResults | null) =>
				previous && index >= previous.total_pages
					? null
					: `/api/catalog?${filters}&page=${index + 1}`,
			fetchCatalog,
			{
				revalidateOnFocus: false,
				revalidateFirstPage: false,
				shouldRetryOnError: false,
			},
		);
	const titles = [
		...new Map(
			(data || [])
				.flatMap((page) => page.results)
				.map((title) => [`${title.media_type}-${title.id}`, title]),
		).values(),
	];
	const hasMore =
		!data || data.length < (data[data.length - 1]?.total_pages || 0);
	const loading =
		!error &&
		(isLoading || isValidating || (data && size > data.length && hasMore));
	// Keep the next row's partial batch for the next page. Only the final page
	// may have an incomplete row, when the catalog has no more titles to offer.
	const visibleTitles = hasMore
		? titles.slice(0, Math.floor(titles.length / columns) * columns)
		: titles;

	useEffect(() => {
		const grid = gridRef.current;
		if (!grid) return;
		const observer = new ResizeObserver(() => {
			setColumns(getComputedStyle(grid).gridTemplateColumns.split(" ").length);
		});
		observer.observe(grid);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel || !hasMore || loading || error) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					observer.disconnect();
					void setSize((count) => count + 1);
				}
			},
			{ rootMargin: "600px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasMore, loading, error, setSize]);

	return (
		<div className="relative flex flex-col gap-6">
			<div
				ref={gridRef}
				className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
			>
				{visibleTitles.map((title) => (
					<Link
						key={`${title.media_type}-${title.id}`}
						href={`/${title.media_type}/${title.id}`}
						className="group min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-400"
					>
						<div className="relative mb-3 aspect-[2/3] overflow-hidden rounded-xl border bg-secondary transition group-hover:border-foreground/30">
							{title.poster_path ? (
								/* biome-ignore lint/performance/noImgElement: Responsive TMDB CDN images. */ <img
									src={imageUrl(title.poster_path)}
									alt={titleName(title)}
									loading="lazy"
									className="size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
								/>
							) : (
								<div className="flex size-full items-center justify-center">
									<Film className="size-10 text-muted-foreground" />
								</div>
							)}
							{title.vote_average > 0 && (
								<Badge
									variant="secondary"
									className="absolute bottom-2 right-2 bg-black/75 text-white"
									aria-label={`Rating ${title.vote_average.toFixed(1)} out of 10`}
								>
									<Star className="size-3 fill-amber-300 text-amber-300" />
									{title.vote_average.toFixed(1)}
								</Badge>
							)}
						</div>
						<h2 className="truncate text-sm font-semibold">
							{titleName(title)}
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{titleYear(title) || "Coming soon"} ·{" "}
							{title.media_type === "tv" ? "TV show" : "Movie"}
						</p>
					</Link>
				))}
			</div>
			{!loading && !error && !titles.length && (
				<div className="py-20 text-center">
					<Film className="mx-auto mb-4 size-9 text-muted-foreground" />
					<h2 className="text-xl font-medium">No titles found</h2>
					<p className="mt-2 text-muted-foreground">
						Try another title or a different category.
					</p>
				</div>
			)}
			<div ref={sentinelRef} className="absolute bottom-0 h-px" />
			{loading && <Loading>Loading titles…</Loading>}
			{error && <LoadError error={error} retry={() => mutate()} />}
		</div>
	);
}
