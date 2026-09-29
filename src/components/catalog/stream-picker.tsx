"use client";

import { Play } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import type { StremioStream } from "@/lib/search/stremio";
import { LoadError, Loading } from "./load-state";

const VideoPlayer = dynamic(() => import("./video-player"), {
	ssr: false,
	loading: () => <div className="h-full w-full bg-black" />,
});

export function StreamPicker({
	imdbId,
	data,
	error,
	retry,
	title,
	poster,
}: {
	imdbId?: string | null;
	data?: { streams: StremioStream[]; subtitleError?: string };
	error?: Error;
	retry: () => void;
	title: string;
	poster?: string;
}) {
	const [selected, setSelected] = useState<StremioStream | null>(null);
	const streams = data?.streams.filter((stream) => stream.url) || [];
	if (!imdbId)
		return (
			<p className="rounded-xl border p-6 text-muted-foreground">
				This title has no IMDb reference yet, so streams cannot be searched.
			</p>
		);
	return (
		<>
			{selected && (
				<PlayerOverlay
					stream={selected}
					title={title}
					poster={poster}
					onClose={() => setSelected(null)}
				/>
			)}
			<div className="flex min-h-10 items-center gap-3">
				<h2 className="text-xl font-semibold">Streams</h2>
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
				<Loading>Searching your providers…</Loading>
			) : !streams.length ? (
				<div className="rounded-xl border bg-card p-8 text-center">
					<h2 className="font-medium">No streams found</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						Try again later, or check your enabled providers and language
						filters.
					</p>
					<Link
						href="/config"
						className="mt-4 inline-block text-sm underline underline-offset-4"
					>
						Open settings
					</Link>
				</div>
			) : (
				<div className="grid gap-4 lg:grid-cols-2">
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
								className="group w-full min-w-0 overflow-hidden rounded-xl border bg-card p-5 text-left shadow-xs transition duration-300 hover:border-foreground/30 hover:bg-accent/50 sm:p-6"
							>
								<span className="flex w-full min-w-0 items-center gap-4 transition-transform duration-300 motion-safe:group-hover:scale-[1.01]">
									<span className="min-w-0 flex-1">
										<span className="mb-2 flex flex-wrap gap-2">
											<Badge variant="secondary">
												{stream.name || "Unknown quality"}
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
	poster,
	onClose,
}: {
	stream: StremioStream;
	title: string;
	poster?: string;
	onClose: () => void;
}) {
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
			aria-label={`Playing ${title}`}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-black p-0 text-white backdrop:bg-black open:flex open:flex-col"
		>
			<div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
				<VideoPlayer
					stream={stream}
					title={title}
					poster={poster}
					onClose={onClose}
				/>
			</div>
		</dialog>,
		document.body,
	);
}
