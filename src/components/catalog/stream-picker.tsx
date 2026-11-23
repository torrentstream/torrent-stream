"use client";

import { Play } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { StremioStream } from "@/lib/search/stremio";
import { LoadError } from "./load-state";

const VideoPlayer = dynamic(() => import("./video-player"), {
	ssr: false,
	loading: () => <div className="h-full w-full bg-black" />,
});

const headingClass = "flex min-h-10 items-center gap-3";
const listClass = "grid gap-4 lg:grid-cols-2";
const cardClass =
	"w-full min-w-0 overflow-hidden rounded-xl border bg-card p-5 shadow-xs sm:p-6";
const cardRowClass = "flex w-full min-w-0 items-center gap-4";

/** Placeholder for the "Streams" heading, used before the picker can mount. */
export function StreamHeadingSkeleton() {
	return (
		<div aria-hidden="true" className={headingClass}>
			<Skeleton className="h-6 w-24" />
		</div>
	);
}

/**
 * Placeholder stream entries: a quality badge, the torrent name, the file
 * name and the two detail lines a stream usually has.
 */
export function StreamListSkeleton() {
	return (
		<div aria-hidden="true" className={listClass}>
			{Array.from({ length: 6 }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: Static placeholders.
				<div key={i} className={cardClass}>
					<div className={cardRowClass}>
						<div className="min-w-0 flex-1">
							<Skeleton className="mb-2 h-5 w-16 rounded-4xl" />
							<div className="flex h-5 items-center sm:h-6">
								<Skeleton className="h-3.5 w-4/5 sm:h-4" />
							</div>
							<div className="mt-1 flex h-5 items-center">
								<Skeleton className="h-3 w-3/5" />
							</div>
							<div className="mt-1 flex h-6 items-center">
								<Skeleton className="h-3 w-2/5" />
							</div>
							<div className="flex h-6 items-center">
								<Skeleton className="h-3 w-1/3" />
							</div>
						</div>
						<Skeleton className="size-10 shrink-0 rounded-full" />
					</div>
				</div>
			))}
		</div>
	);
}

export function StreamPicker({
	imdbId,
	data,
	error,
	retry,
	title,
}: {
	imdbId?: string | null;
	data?: { streams: StremioStream[]; subtitleError?: string };
	error?: Error;
	retry: () => void;
	title: string;
}) {
	const { t } = useLanguage();
	const [selected, setSelected] = useState<StremioStream | null>(null);
	const streams = data?.streams.filter((stream) => stream.url) || [];
	if (!imdbId)
		return (
			<p className="rounded-xl border p-6 text-muted-foreground">
				{t(
					"This title has no IMDb reference yet, so streams cannot be searched.",
				)}
			</p>
		);
	return (
		<>
			{selected && (
				<PlayerOverlay
					stream={selected}
					title={title}
					onClose={() => setSelected(null)}
				/>
			)}
			<div className={headingClass}>
				<h2 className="text-xl font-semibold">{t("Streams")}</h2>
				{data && <Badge variant="secondary">{streams.length}</Badge>}
			</div>
			{data?.subtitleError && (
				<p aria-live="polite" className="text-sm text-muted-foreground">
					{data.subtitleError}
				</p>
			)}
			{error ? (
				<LoadError error={error} retry={retry} />
			) : !data ? (
				<StreamListSkeleton />
			) : !streams.length ? (
				<div className="rounded-xl border bg-card p-8 text-center">
					<h2 className="font-medium">{t("No streams found")}</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						{t(
							"Try again later, or check your enabled providers and language filters.",
						)}
					</p>
					<Link
						href="/config"
						className="mt-4 inline-block text-sm underline underline-offset-4"
					>
						{t("Open settings")}
					</Link>
				</div>
			) : (
				<div className={listClass}>
					{streams.map((stream) => {
						const [name, ...details] = (
							stream.description ||
							stream.title ||
							stream.behaviorHints?.filename ||
							"Video stream"
						).split("\n");
						return (
							<button
								type="button"
								key={stream.url}
								onClick={() => setSelected(stream)}
								className={`group ${cardClass} text-left transition duration-300 hover:border-foreground/30 hover:bg-accent/50`}
							>
								<span
									className={`${cardRowClass} transition-transform duration-300 motion-safe:group-hover:scale-[1.01]`}
								>
									<span className="min-w-0 flex-1">
										<span className="mb-2 flex flex-wrap gap-2">
											<Badge variant="secondary">
												{stream.name || t("Unknown quality")}
											</Badge>
										</span>
										<span className="block break-words text-sm font-bold [overflow-wrap:anywhere] sm:text-base">
											{name.replaceAll(".", ".\u200b")}
										</span>
										{stream.behaviorHints?.filename && (
											<span className="mt-1 block break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
												{stream.behaviorHints.filename}
											</span>
										)}
										<span className="mt-1 block whitespace-pre-line text-xs leading-6 text-muted-foreground">
											{details.join("\n")}
										</span>
									</span>
									<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary transition group-hover:bg-foreground group-hover:text-background">
										<Play className="size-4 fill-current" />
									</span>
								</span>
							</button>
						);
					})}
				</div>
			)}
		</>
	);
}

function PlayerOverlay({
	stream,
	title,
	onClose,
}: {
	stream: StremioStream;
	title: string;
	onClose: () => void;
}) {
	const { t } = useLanguage();
	const dialogRef = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const dialog = dialogRef.current;
		const overflow = document.body.style.overflow;
		const previousFocus = document.activeElement;
		dialog?.showModal();
		document.body.style.overflow = "hidden";
		return () => {
			dialog?.close();
			document.body.style.overflow = overflow;
			if (previousFocus instanceof HTMLElement)
				previousFocus.focus({ preventScroll: true });
		};
	}, []);
	return createPortal(
		<dialog
			ref={dialogRef}
			aria-label={t("Playing {title}", { title })}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-black p-0 text-white backdrop:bg-black open:flex open:flex-col"
		>
			<div className="player-surface min-h-0 flex-1">
				<VideoPlayer stream={stream} title={title} onClose={onClose} />
			</div>
		</dialog>,
		document.body,
	);
}
