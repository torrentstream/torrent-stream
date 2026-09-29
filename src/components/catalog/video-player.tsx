"use client";

import {
	type MoviElement,
	MoviPlayer,
	MoviTrack,
} from "movi-player/react/slim";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { getPlaybackStats } from "@/app/actions";
import { subtitleLanguageCode } from "@/lib/media/subtitle-language";
import type { StremioStream } from "@/lib/search/stremio";

type PlayerProps = {
	stream: StremioStream;
	title: string;
	poster?: string;
	onClose: () => void;
};

export default function VideoPlayer(props: PlayerProps) {
	const [ready, setReady] = useState(false);
	const [error, setError] = useState("");
	const [attempt, setAttempt] = useState(0);
	const uri = props.stream.url?.split("/api/file/")[1]?.split("?")[0];
	const { data: stats } = useSWR(
		uri ? ["playback-stats", uri] : null,
		([, id]) => getPlaybackStats(decodeURIComponent(id)),
		{ refreshInterval: 2000, revalidateOnFocus: false },
	);
	const status = stats
		? `↓ ${stats.download}/s · ↑ ${stats.upload}/s · ${stats.peers} peers · ${stats.downloaded} downloaded`
		: "Connecting to peers…";
	// biome-ignore lint/correctness/useExhaustiveDependencies: Retry starts a new preparation attempt.
	useEffect(() => {
		const streamUrl = props.stream.url;
		if (!streamUrl) return;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 300_000);
		setReady(false);
		setError("");
		const prepare = async () => {
			const url = new URL(streamUrl, window.location.href);
			url.searchParams.set("prepare", "1");
			// Warm the header and end-of-file index before Movi starts its fixed read timer.
			for (const range of ["bytes=0-2097151", "bytes=-262144"]) {
				const response = await fetch(url, {
					headers: { Range: range },
					signal: controller.signal,
				});
				if (!response.ok) throw new Error("Stream unavailable");
				await response.arrayBuffer();
			}
		};
		let active = true;
		prepare()
			.then(() => {
				if (active) setReady(true);
			})
			.catch(() => {
				if (active)
					setError(
						controller.signal.aborted
							? "The stream did not become ready within five minutes."
							: "Could not load torrent data. Try again or choose another stream.",
					);
			})
			.finally(() => clearTimeout(timeout));
		return () => {
			active = false;
			clearTimeout(timeout);
			controller.abort();
		};
	}, [props.stream.url, attempt]);
	return (
		<Playback
			{...props}
			status={status}
			ready={ready}
			error={error}
			onRetry={() => setAttempt((value) => value + 1)}
		/>
	);
}

function Playback({
	stream,
	title,
	poster,
	onClose,
	status,
	ready,
	error,
	onRetry,
}: PlayerProps & {
	status: string;
	ready: boolean;
	error: string;
	onRetry: () => void;
}) {
	const playerRef = useRef<MoviElement>(null);
	useEffect(() => {
		const root = playerRef.current?.shadowRoot;
		if (!root) return;
		root.querySelector(".movi-title-text")?.setAttribute("data-stats", status);
	}, [status]);
	useEffect(() => {
		const root = playerRef.current?.shadowRoot;
		if (!root) return;
		const tracks = new Map(
			(stream.subtitles || []).map((track) => [`external-${track.id}`, track]),
		);
		const updateBadges = () => {
			for (const item of root.querySelectorAll<HTMLElement>(
				".movi-subtitle-track-item[data-subtitle-lang]",
			)) {
				const track = tracks.get(item.dataset.subtitleLang || "");
				const badge = item.querySelector<HTMLElement>(
					".movi-subtitle-track-info",
				);
				if (!badge) continue;
				const text = track?.label
					? `${subtitleLanguageCode(track.lang)} · Text`
					: "";
				if (badge.textContent !== text) badge.textContent = text;
				badge.hidden = !text;
			}
		};
		updateBadges();
		const observer = new MutationObserver(updateBadges);
		observer.observe(root, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [stream.subtitles]);
	useEffect(() => {
		const player = playerRef.current;
		if (!player) return;
		player.addEventListener("back", onClose);
		const hideStats = () => player.setAttribute("data-playback-failed", "");
		const showStats = () => player.removeAttribute("data-playback-failed");
		player.addEventListener("errordisplay", hideStats);
		player.addEventListener("loadstart", showStats);
		const errorBack = document.createElement("button");
		errorBack.type = "button";
		errorBack.className = "movi-retry-btn movi-error-back";
		errorBack.textContent = "Back";
		errorBack.addEventListener("click", onClose);
		player.shadowRoot?.querySelector(".movi-broken-text")?.append(errorBack);
		// MoviPlayer exposes a native title bar but no subtitle slot. A pseudo-element
		// keeps live stats inside that bar and shares its control visibility.
		const titleText = player.shadowRoot?.querySelector(".movi-title-text");
		const titleBar = titleText?.parentElement;
		const backButton = titleBar?.querySelector(".movi-title-back");
		const bubble = document.createElement("div");
		bubble.className = "torrent-title-bubble";
		if (titleBar && backButton && titleText) {
			titleBar.append(bubble);
			bubble.append(backButton, titleText);
		}
		const backPath = player.shadowRoot?.querySelector(
			".movi-title-back svg path",
		);
		const originalBackPath = backPath?.getAttribute("d");
		backPath?.setAttribute("d", "M15 18l-6-6 6-6");
		const style = document.createElement("style");
		style.textContent = `
      button:not(:disabled), a[href], select:not(:disabled), input[type="range"]:not(:disabled), [role="button"]:not([aria-disabled="true"]) { cursor: pointer; }
      button:disabled, select:disabled, input:disabled, [aria-disabled="true"] { cursor: not-allowed; }

            :host([data-playback-failed]) .movi-title-text::after,
            :host(.torrent-prepare-error) .movi-title-text::after { display: none; }
            :host(.torrent-preparing) .movi-unmute-overlay,
            :host(.torrent-preparing) .movi-empty-state,
            :host(.torrent-preparing) .movi-controls-container,
            :host(.torrent-preparing) .movi-center-play-pause { display: none !important; }
            :host(.torrent-preparing:not(.torrent-prepare-error)) .movi-loading-indicator {
                display: flex !important; opacity: 1 !important;
            }
            :host(.torrent-preparing) .movi-title-bar {
                display: flex !important; opacity: 1 !important; transform: none !important;
            }
            :host(.torrent-preparing) .movi-title-back { pointer-events: auto; }
            .movi-unmute-overlay { top: auto; bottom: 110px; left: 50%; transform: translateX(-50%); }
            .torrent-title-bubble {
                display: flex; align-items: center; gap: 8px;
                max-width: 100%; min-width: 0; padding: 8px 24px 8px 8px;
                border-radius: 999px; background: var(--movi-controls-group-bg);
            }

			.movi-error-back { display: flex; margin: 12px auto 0; }
			/* Give release names room while keeping the menu inside a phone viewport. */
			.movi-subtitle-track-menu {
				width: min(420px, calc(100vw - 24px));
				min-width: 0;
				max-width: min(420px, calc(100vw - 24px));
			}
			.movi-subtitle-track-item[data-subtitle-lang] .movi-subtitle-track-label {
				white-space: pre-line;
				overflow-wrap: anywhere;
				line-height: 1.5;
				text-align: left;
			}

			/* Movi measures left padding using a cached font size. Let CSS center
			   ordinary text cues so resizing cannot leave that stale offset behind.
			   Preserve the separate positioning used by VTT karaoke and bitmap cues. */
			.movi-subtitle-overlay:not(.movi-subtitle-format-vtt) .movi-subtitle-anchor {
				padding-left: 0 !important;
				text-align: center !important;
			}
			.movi-subtitle-overlay:not(.movi-subtitle-format-vtt) .movi-subtitle-block {
				max-width: 92%;
			}

			.movi-title-bar.movi-title-with-back {
				gap: 10px;
				padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 28px max(16px, env(safe-area-inset-left));
			}
			.movi-title-back {
				width: 44px;
				height: 44px;
				margin: 0;
				background: transparent;
			}
			.movi-title-back svg { width: 22px; height: 22px; filter: none; }
			.movi-title-back svg path ~ path { display: none; }
			.movi-title-back:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
			.movi-title-bar.movi-title-with-back .movi-title-text {
                flex: 0 1 auto; min-width: 0; text-align: left;
                padding: 0; background: transparent;
				font-size: 15px;
				line-height: 1.4;
			}
			.movi-title-text::after {
				content: attr(data-stats);
				display: block;
				margin-top: 2px;
				font-size: 12px;
				font-weight: 400;
				opacity: .65;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: pre-line;
                overflow-wrap: anywhere;
			}
			@media (max-width: 600px) {
				.movi-title-bar.movi-title-with-back { gap: 8px; padding-left: max(12px, env(safe-area-inset-left)); }
				.movi-title-bar.movi-title-with-back .movi-title-text { font-size: 13px; padding: 0; }
				.movi-title-text::after { font-size: 11px; }
			}
		`;

		player.shadowRoot?.append(style);
		return () => {
			player.removeEventListener("back", onClose);
			player.removeEventListener("errordisplay", hideStats);
			player.removeEventListener("loadstart", showStats);
			errorBack.removeEventListener("click", onClose);
			errorBack.remove();
			if (titleBar && backButton && titleText)
				titleBar.append(backButton, titleText);
			bubble.remove();
			if (originalBackPath) backPath?.setAttribute("d", originalBackPath);

			style.remove();
		};
	}, [onClose]);
	return (
		<div className="relative h-full w-full bg-black">
			<MoviPlayer
				ref={playerRef}
				className={
					ready
						? undefined
						: `torrent-preparing${error ? " torrent-prepare-error" : ""}`
				}
				showtitle
				titlemode="both back"
				src={ready ? stream.url : undefined}
				title={title}
				poster={poster}
				controls
				autoplay
				playsinline
				fastseek
				sw="auto"
				theme="dark"
				wasmurl="/api/player/wasm"
				style={{
					display: "block",
					width: "100%",
					height: "100%",
					overflow: "clip",
				}}
			>
				{/* Movi scans tracks on connection, before the torrent source is ready. */}
				{stream.subtitles?.map((subtitle) => (
					<MoviTrack
						key={subtitle.id}
						src={subtitle.url}
						kind="subtitles"
						format={
							subtitle.format ||
							(/\.srt(?:$|[?#])/i.test(subtitle.lang) ? "srt" : "vtt")
						}
						srcLang={`external-${subtitle.id}`}
						label={subtitle.label || subtitle.lang}
					/>
				))}
			</MoviPlayer>
			{!ready && (
				<output className="sr-only">
					{error || "Waiting for torrent data"}
				</output>
			)}
			{error && (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white pointer-events-none">
					<h2 className="text-xl font-semibold">Couldn’t prepare stream</h2>
					<p className="text-sm text-white/60">{error}</p>
					<button
						type="button"
						className="pointer-events-auto rounded-lg bg-white/15 px-5 py-2.5 hover:bg-white/25"
						onClick={onRetry}
					>
						Retry
					</button>
					<button
						type="button"
						className="pointer-events-auto rounded-lg bg-white/15 px-5 py-2.5 hover:bg-white/25"
						onClick={onClose}
					>
						Back
					</button>
				</div>
			)}
		</div>
	);
}
