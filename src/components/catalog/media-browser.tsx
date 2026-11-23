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
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type CatalogResults,
	fetchCatalog,
	imageUrl,
	titleName,
	titleYear,
} from "@/lib/media/catalog";
import { BrowseSearch } from "./browse-search";
import { FilterSelect } from "./filter-select";
import { LoadError } from "./load-state";

const headerClass = "flex flex-wrap items-center justify-between gap-4";
const filtersClass =
	"grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:w-auto xl:shrink-0";
const gridWrapperClass = "relative flex flex-col gap-6";
const gridClass =
	"grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6";
/** Titles in a full catalog page; some pages hold fewer after filtering. */
const PAGE_SIZE = 20;

/** Placeholder with the dimensions of a title card in the grid. */
function TitleCardSkeleton({ className = "" }: { className?: string }) {
	return (
		<div aria-hidden="true" className={`min-w-0 ${className}`}>
			<Skeleton className="mb-3 aspect-[2/3] rounded-xl" />
			<div className="flex h-5 items-center">
				<Skeleton className="h-3.5 w-3/4" />
			</div>
			<div className="mt-1 flex h-4 items-center">
				<Skeleton className="h-3 w-1/2" />
			</div>
		</div>
	);
}

/** Stands in for the whole browser until it can read the URL's filters. */
export function MediaBrowserSkeleton() {
	return (
		<div className="space-y-6">
			<div aria-hidden="true" className={headerClass}>
				<Skeleton className="h-[50px] w-full rounded-full xl:w-auto xl:flex-1" />
				<div className={filtersClass}>
					{Array.from({ length: 4 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: Static placeholders.
						<Skeleton key={i} className="h-11 rounded-full xl:w-40" />
					))}
				</div>
			</div>
			<div className={gridWrapperClass}>
				<div className={gridClass}>
					{Array.from({ length: PAGE_SIZE }, (_, i) => (
						<TitleCardSkeleton
							// biome-ignore lint/suspicious/noArrayIndexKey: Static placeholders.
							key={i}
							// The column count is unknown before hydration, so the cards
							// that would start a partial row are hidden with CSS instead:
							// 20 fills 2 and 5 columns, 18 fills 3 and 6.
							className={i >= 18 ? "sm:max-lg:hidden xl:hidden" : ""}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

export function MediaBrowser() {
	const { t, language } = useLanguage();
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
		type !== "all"
			? `/api/catalog?type=${type}&genres=1&language=${language}`
			: null,
		fetchCatalog,
	);
	const filters = new URLSearchParams({
		type,
		language,
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
			<header className={headerClass}>
				<BrowseSearch query={query} onSearch={(q) => navigate({ q })} />
				<div className={filtersClass}>
					<FilterSelect
						icon={Tags}
						aria-label={t("Genre")}
						disabled={!discovery}
						title={
							!discovery
								? t(
										"Choose Movies or TV shows and a non-trending sort to filter by genre or year.",
									)
								: undefined
						}
						value={discovery ? genre : ""}
						onChange={(e) => navigate({ genre: e.target.value })}
					>
						<option value="">{t("All genres")}</option>
						{genres?.genres.map((g) => (
							<option key={g.id} value={g.id}>
								{g.name}
							</option>
						))}
					</FilterSelect>
					<FilterSelect
						icon={Calendar}
						aria-label={t("Year")}
						disabled={!discovery}
						title={
							!discovery
								? t(
										"Choose Movies or TV shows and a non-trending sort to filter by genre or year.",
									)
								: undefined
						}
						value={discovery ? year : ""}
						onChange={(e) => navigate({ year: e.target.value })}
					>
						<option value="">{t("All years")}</option>
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
						aria-label={t("Type")}
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
						<option value="all">{t("All titles")}</option>
						<option value="movie">{t("Movies")}</option>
						<option value="tv">{t("TV shows")}</option>
					</FilterSelect>
					<FilterSelect
						icon={ArrowDownWideNarrow}
						aria-label={t("Sort")}
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
						{query && <option value="relevance">{t("Relevance")}</option>}
						<option value="trending">{t("Trending")}</option>
						<option disabled={type === "all"} value="popular">
							{t("Popular")}
						</option>
						<option disabled={type === "all"} value="rating">
							{t("Top rated")}
						</option>
						<option disabled={type === "all"} value="newest">
							{t("Newest")}
						</option>
						<option disabled={type === "all"} value="oldest">
							{t("Oldest")}
						</option>
					</FilterSelect>
				</div>
			</header>
			<TitleGrid key={filters} filters={filters} />
		</div>
	);
}

function TitleGrid({ filters }: { filters: string }) {
	const { t } = useLanguage();
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
	// Placeholders for the rows the page being loaded is expected to add, so
	// they are replaced in place: the held-back partial row plus a full page.
	// A revalidation that adds no page (`loading` without one pending) gets none.
	const pagePending = !data || (size > data.length && hasMore);
	const skeletons =
		loading && pagePending
			? Math.max(
					Math.floor(
						(titles.length - visibleTitles.length + PAGE_SIZE) / columns,
					),
					1,
				) * columns
			: 0;

	// Measured before the first paint so the skeleton rows are whole from the
	// start; the grid always has cards or skeletons to derive its columns from.
	useLayoutEffect(() => {
		const grid = gridRef.current;
		if (!grid) return;
		const measure = () =>
			setColumns(getComputedStyle(grid).gridTemplateColumns.split(" ").length);
		measure();
		const observer = new ResizeObserver(measure);
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
		<div className={gridWrapperClass}>
			<div ref={gridRef} className={gridClass}>
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
									aria-label={t("Rating {rating} out of 10", {
										rating: title.vote_average.toFixed(1),
									})}
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
							{titleYear(title) || t("Coming soon")} ·{" "}
							{title.media_type === "tv" ? t("TV show") : t("Movie")}
						</p>
					</Link>
				))}
				{Array.from({ length: skeletons }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: Static placeholders.
					<TitleCardSkeleton key={i} />
				))}
			</div>
			{!loading && !error && !titles.length && (
				<div className="py-20 text-center">
					<Film className="mx-auto mb-4 size-9 text-muted-foreground" />
					<h2 className="text-xl font-medium">{t("No titles found")}</h2>
					<p className="mt-2 text-muted-foreground">
						{t("Try another title or a different category.")}
					</p>
				</div>
			)}
			<div ref={sentinelRef} className="absolute bottom-0 h-px" />
			{error && <LoadError error={error} retry={() => mutate()} />}
		</div>
	);
}
