"use client";

import { MoviElement } from "movi-player/element/slim";
import { MoviPlayer, MoviTrack } from "movi-player/react/slim";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { getPlaybackStats } from "@/app/actions";
import { useLanguage } from "@/components/language-provider";
import type { StremioStream } from "@/lib/search/stremio";
import {
	labelSubtitleBadges,
	patchPlayerChrome,
	setTitleStats,
	subtitleTrackFormat,
	subtitleTrackLang,
	useEdgeToEdgeFullscreen,
	useScreenWakeLock,
} from "./movi-patches";

type PlayerProps = {
	stream: StremioStream;
	title: string;
	onClose: () => void;
};

export default function VideoPlayer(props: PlayerProps) {
	const { t } = useLanguage();
	const [ready, setReady] = useState(false);
	const [error, setError] = useState("");
	const [attempt, setAttempt] = useState(0);
	const uri = props.stream.url?.split("/api/file/")[1]?.split("?")[0];
	const fileIndex = props.stream.url
		? Number(
				new URL(props.stream.url, "http://localhost").searchParams.get("f"),
			)
		: 0;
	const { data: stats } = useSWR(
		uri ? ["playback-stats", uri, fileIndex] : null,
		([, id, index]) => getPlaybackStats(decodeURIComponent(id), index),
		{ refreshInterval: 2000, revalidateOnFocus: false },
	);
	const status = stats
		? t(
				stats.downloaded === null
					? "↓ {download}/s · ↑ {upload}/s · {peers} peers"
					: "↓ {download}/s · ↑ {upload}/s · {peers} peers · {downloaded} downloaded",
				{
					download: stats.download,
					upload: stats.upload,
					peers: stats.peers,
					downloaded: stats.downloaded ?? "",
				},
			)
		: t("Connecting to peers…");
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
					// Kept untranslated; rendering translates it.
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
	const { t } = useLanguage();
	const playerRef = useRef<MoviElement>(null);
	useEdgeToEdgeFullscreen(playerRef);
	useScreenWakeLock(playerRef);
	useEffect(() => {
		if (playerRef.current) setTitleStats(playerRef.current, status);
	}, [status]);
	useEffect(() => {
		const player = playerRef.current;
		if (!player) return;
		return labelSubtitleBadges(player, stream.subtitles || [], t);
	}, [stream.subtitles, t]);
	useEffect(() => {
		const player = playerRef.current;
		if (!player) return;
		player.addEventListener("back", onClose);
		const unpatch = patchPlayerChrome(player, {
			onClose,
			backLabel: t("Back"),
		});
		return () => {
			player.removeEventListener("back", onClose);
			unpatch();
		};
	}, [onClose, t]);
	return (
		<div className="relative h-full w-full bg-black">
			<MoviPlayer
				ref={playerRef}
				className={`app-player${ready ? "" : ` torrent-preparing${error ? " torrent-prepare-error" : ""}`}`}
				showtitle
				titlemode="both back"
				src={ready ? stream.url : undefined}
				title={title}
				controls
				autoplay
				playsinline
				fastseek
				sw="auto"
				theme="dark"
				wasmurl={`/api/player/wasm?v=${MoviElement.version}`}
				style={{
					display: "block",
					width: "100%",
					height: "100%",
					overflow: "clip",
				}}
			>
				{/* Movi scans tracks on connection, before the torrent source is ready. */}
				{stream.subtitles?.map((subtitle) => {
					const format = subtitleTrackFormat(subtitle);
					// The player cannot parse other formats (.ass, .sub, ...).
					if (!format) return null;
					return (
						<MoviTrack
							key={subtitle.id}
							src={subtitle.url}
							kind="subtitles"
							format={format}
							srcLang={subtitleTrackLang(subtitle)}
							label={subtitle.label || subtitle.lang}
						/>
					);
				})}
			</MoviPlayer>
			{!ready && (
				<output className="sr-only">
					{error ? t(error) : t("Waiting for torrent data")}
				</output>
			)}
			{error && (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white pointer-events-none">
					<h2 className="text-xl font-semibold">
						{t("Couldn’t prepare stream")}
					</h2>
					<p className="text-sm text-white/60">{t(error)}</p>
					<button
						type="button"
						className="pointer-events-auto rounded-lg bg-white/15 px-5 py-2.5 hover:bg-white/25"
						onClick={onRetry}
					>
						{t("Retry")}
					</button>
					<button
						type="button"
						className="pointer-events-auto rounded-lg bg-white/15 px-5 py-2.5 hover:bg-white/25"
						onClick={onClose}
					>
						{t("Back")}
					</button>
				</div>
			)}
		</div>
	);
}
