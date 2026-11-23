// Everything here reaches into movi-player beyond its public API: shadow DOM
// class names, custom events and host attributes. Re-check this file when
// upgrading movi-player. Every patch returns a function that undoes it.

import type { MoviElement } from "movi-player/element/slim";
import { type RefObject, useEffect } from "react";
import { subtitleLanguageCode } from "@/lib/media/subtitle-language";
import type { StremioStream } from "@/lib/search/stremio";

type Cleanup = () => void;
type Subtitle = NonNullable<StremioStream["subtitles"]>[number];
type Translate = (text: string, values?: Record<string, string>) => string;

// External subtitle parsers shipped by movi-player that MoviTrack's `format`
// accepts. It parses anything else as VTT, which yields no cues.
const SUBTITLE_FORMATS = ["srt", "vtt"] as const;
export type SubtitleFormat = (typeof SUBTITLE_FORMATS)[number];

const isSubtitleFormat = (value: string | undefined): value is SubtitleFormat =>
	(SUBTITLE_FORMATS as readonly string[]).includes(value || "");

/**
 * The format to hand to MoviTrack, or null when the player cannot show the
 * track. Torrent subtitles carry no format; their `lang` is the file name.
 */
export function subtitleTrackFormat(
	subtitle: Pick<Subtitle, "format" | "lang">,
): SubtitleFormat | null {
	if (subtitle.format) return subtitle.format;
	const extension = /\.([a-z0-9]+)(?:$|[?#])/i
		.exec(subtitle.lang)?.[1]
		.toLowerCase();
	return isSubtitleFormat(extension) ? extension : null;
}

/** MoviTrack's `srcLang` for a subtitle; the player echoes it back as `data-subtitle-lang`. */
export const subtitleTrackLang = (subtitle: Pick<Subtitle, "id">) =>
	`external-${subtitle.id}`;

// Host classes/attributes used below: .torrent-preparing and
// .torrent-prepare-error (set by VideoPlayer), [data-playback-failed],
// [data-edge-to-edge]. Everything prefixed .movi- is a movi-player internal.
const PLAYER_STYLES = `
      /* Filled controls need the app's contrasting text/knob color. */
      .movi-resume-yes, .movi-timeline-generate-btn, .movi-settings-badge {
        color: var(--primary-foreground);
      }
      .movi-settings-switch.is-on .movi-settings-knob {
        background: var(--primary-foreground);
      }
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
			:host([data-edge-to-edge]) .movi-controls-container {
				padding-left: max(16px, env(safe-area-inset-left));
				padding-right: max(16px, env(safe-area-inset-right));
				padding-bottom: max(16px, env(safe-area-inset-bottom));
			}
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

/**
 * Restyles the player's title bar and error screen to match the app.
 * Patches are applied and undone in the order listed.
 */
export function patchPlayerChrome(
	player: MoviElement,
	options: { onClose: () => void; backLabel: string },
): Cleanup {
	const root = player.shadowRoot;
	const cleanups = [
		hideStatsAfterPlaybackError(player),
		addErrorBackButton(root, options.backLabel, options.onClose),
		groupTitleIntoBubble(root),
		showChevronBackIcon(root),
		injectPlayerStyles(root),
	];
	return () => {
		for (const cleanup of cleanups) cleanup();
	};
}

// Depends on: the "errordisplay" and "loadstart" events; PLAYER_STYLES hides the stats line.
function hideStatsAfterPlaybackError(player: MoviElement): Cleanup {
	const hideStats = () => player.setAttribute("data-playback-failed", "");
	const showStats = () => player.removeAttribute("data-playback-failed");
	player.addEventListener("errordisplay", hideStats);
	player.addEventListener("loadstart", showStats);
	return () => {
		player.removeEventListener("errordisplay", hideStats);
		player.removeEventListener("loadstart", showStats);
	};
}

// Depends on: .movi-broken-text (error screen body), .movi-retry-btn (button look).
function addErrorBackButton(
	root: ShadowRoot | null,
	label: string,
	onClose: () => void,
): Cleanup {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "movi-retry-btn movi-error-back";
	button.textContent = label;
	button.addEventListener("click", onClose);
	root?.querySelector(".movi-broken-text")?.append(button);
	return () => {
		button.removeEventListener("click", onClose);
		button.remove();
	};
}

// Depends on: .movi-title-text and .movi-title-back being siblings inside the title bar.
function groupTitleIntoBubble(root: ShadowRoot | null): Cleanup {
	const titleText = root?.querySelector(".movi-title-text");
	const titleBar = titleText?.parentElement;
	const backButton = titleBar?.querySelector(".movi-title-back");
	const bubble = document.createElement("div");
	bubble.className = "torrent-title-bubble";
	if (titleBar && backButton && titleText) {
		titleBar.append(bubble);
		bubble.append(backButton, titleText);
	}
	return () => {
		if (titleBar && backButton && titleText)
			titleBar.append(backButton, titleText);
		bubble.remove();
	};
}

// Depends on: the first <path> of the .movi-title-back icon (PLAYER_STYLES hides the others).
function showChevronBackIcon(root: ShadowRoot | null): Cleanup {
	const path = root?.querySelector(".movi-title-back svg path");
	const original = path?.getAttribute("d");
	path?.setAttribute("d", "M15 18l-6-6 6-6");
	return () => {
		if (original) path?.setAttribute("d", original);
	};
}

// Depends on: every .movi-* class named in PLAYER_STYLES.
function injectPlayerStyles(root: ShadowRoot | null): Cleanup {
	const style = document.createElement("style");
	style.textContent = PLAYER_STYLES;
	root?.append(style);
	return () => style.remove();
}

// Depends on: .movi-title-text. MoviPlayer has a title bar but no subtitle
// slot, so PLAYER_STYLES renders data-stats as a pseudo-element inside it,
// which also shares the bar's control visibility.
export function setTitleStats(player: MoviElement, stats: string) {
	player.shadowRoot
		?.querySelector(".movi-title-text")
		?.setAttribute("data-stats", stats);
}

// Depends on: .movi-subtitle-track-item[data-subtitle-lang] menu rows and their
// .movi-subtitle-track-info badge, re-rendered by the player at will.
export function labelSubtitleBadges(
	player: MoviElement,
	subtitles: Subtitle[],
	t: Translate,
): Cleanup {
	const root = player.shadowRoot;
	if (!root) return () => {};
	const tracks = new Map(
		subtitles.map((track) => [subtitleTrackLang(track), track]),
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
				? t("{language} · Text", {
						language: subtitleLanguageCode(track.lang),
					})
				: "";
			if (badge.textContent !== text) badge.textContent = text;
			badge.hidden = !text;
		}
	};
	updateBadges();
	const observer = new MutationObserver(updateBadges);
	observer.observe(root, { childList: true, subtree: true });
	return () => observer.disconnect();
}

/**
 * Where element fullscreen is unavailable (notably iPhone Safari), the
 * fullscreen button instead toggles drawing under the display cutouts, and
 * is hidden when it could not change anything.
 * Depends on: the "movi-fullscreen-request" event, setHostFullscreen() and
 * the controlslist="nofullscreen" token.
 */
export function useEdgeToEdgeFullscreen(
	playerRef: RefObject<MoviElement | null>,
) {
	useEffect(() => {
		const player = playerRef.current;
		if (!player) return;
		const overlay = player.closest("dialog");
		const viewport = document.querySelector<HTMLMetaElement>(
			'meta[name="viewport"]',
		);
		const originalViewport = viewport?.content;
		// Opt into the physical screen only during playback. Safe-area padding
		// keeps the normal player clear of cutouts until fullscreen is selected.
		if (viewport)
			viewport.content = `${viewport.content.replace(/,?\s*viewport-fit=[^,]+/, "")}, viewport-fit=cover`;
		const probe = document.createElement("div");
		probe.style.cssText =
			"position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
		document.body.append(probe);
		let edgeToEdge = false;
		const updateFullscreenControl = () => {
			const insets = getComputedStyle(probe);
			const canExpandIntoCutout =
				parseFloat(insets.paddingLeft) > 0 ||
				parseFloat(insets.paddingRight) > 0;
			const bounds = overlay?.getBoundingClientRect();
			const fillsViewport =
				bounds &&
				Math.abs(bounds.left) < 1 &&
				Math.abs(bounds.top) < 1 &&
				Math.abs(bounds.width - window.innerWidth) < 1 &&
				Math.abs(bounds.height - window.innerHeight) < 1;
			// A viewport overlay is already the best fullscreen available on
			// browsers without element fullscreen (notably iPhone Safari).
			const redundant =
				fillsViewport &&
				!document.fullscreenEnabled &&
				!canExpandIntoCutout &&
				!edgeToEdge;
			const tokens = new Set(
				(player.getAttribute("controlslist") || "")
					.split(/\s+/)
					.filter(Boolean),
			);
			if (redundant) tokens.add("nofullscreen");
			else tokens.delete("nofullscreen");
			if (tokens.size)
				player.setAttribute("controlslist", [...tokens].join(" "));
			else player.removeAttribute("controlslist");
		};
		const onFullscreenRequest = (event: Event) => {
			if (document.fullscreenEnabled || !overlay) return;
			event.preventDefault();
			edgeToEdge = !edgeToEdge;
			overlay.toggleAttribute("data-edge-to-edge", edgeToEdge);
			player.toggleAttribute("data-edge-to-edge", edgeToEdge);
			player.setHostFullscreen(edgeToEdge);
			updateFullscreenControl();
		};
		player.addEventListener("movi-fullscreen-request", onFullscreenRequest);
		const observer = new ResizeObserver(updateFullscreenControl);
		observer.observe(player);
		updateFullscreenControl();
		window.addEventListener("resize", updateFullscreenControl);
		document.addEventListener("fullscreenchange", updateFullscreenControl);
		return () => {
			player.removeEventListener(
				"movi-fullscreen-request",
				onFullscreenRequest,
			);
			player.setHostFullscreen(false);
			overlay?.removeAttribute("data-edge-to-edge");
			probe.remove();
			if (viewport && originalViewport !== undefined)
				viewport.content = originalViewport;
			observer.disconnect();
			window.removeEventListener("resize", updateFullscreenControl);
			document.removeEventListener("fullscreenchange", updateFullscreenControl);
		};
	}, [playerRef]);
}

/**
 * Keeps the screen awake while the video is actually playing and visible.
 * Depends on: the `playing` property and the "statechange" event detail
 * ("playing" / "buffering" / "seeking" / other).
 */
export function useScreenWakeLock(playerRef: RefObject<MoviElement | null>) {
	useEffect(() => {
		const player = playerRef.current;
		if (!player || !navigator.wakeLock) return;
		let active = true;
		let wanted = player.playing;
		let pending = false;
		let lock: WakeLockSentinel | null = null;
		const shouldHold = () =>
			active && wanted && document.visibilityState === "visible";
		const release = () => {
			const previous = lock;
			lock = null;
			if (previous) void previous.release().catch(() => {});
		};
		const update = async () => {
			if (!shouldHold()) {
				release();
				return;
			}
			if (lock || pending) return;
			pending = true;
			try {
				const acquired = await navigator.wakeLock.request("screen");
				if (!shouldHold()) await acquired.release();
				else {
					lock = acquired;
					acquired.addEventListener("release", () => {
						if (lock === acquired) lock = null;
					});
				}
			} catch {
				// Low power mode, browser policy, or an insecure origin may deny it.
			} finally {
				pending = false;
			}
		};
		const onStateChange = (event: Event) => {
			const state = (event as CustomEvent<string>).detail;
			if (state === "playing") wanted = true;
			else if (state !== "buffering" && state !== "seeking") wanted = false;
			void update();
		};
		const stop = () => {
			wanted = false;
			void update();
		};
		player.addEventListener("statechange", onStateChange);
		for (const event of ["pause", "ended", "error", "loadstart"])
			player.addEventListener(event, stop);
		document.addEventListener("visibilitychange", update);
		void update();
		return () => {
			active = false;
			release();
			player.removeEventListener("statechange", onStateChange);
			for (const event of ["pause", "ended", "error", "loadstart"])
				player.removeEventListener(event, stop);
			document.removeEventListener("visibilitychange", update);
		};
	}, [playerRef]);
}
