import { createHash } from "node:crypto";
import { getRuntimeConfig } from "@/lib/config/runtime";
import type { StremioStream } from "@/lib/search/stremio";

const API = "https://api.opensubtitles.com/api/v1";
type Credentials = { apiKey: string; username: string; password: string };
class SubtitleError extends Error {
	constructor(
		message: string,
		readonly status = 502,
	) {
		super(message);
	}
}
let session:
	| { key: string; expires: number; token: string; base: string }
	| undefined;
const downloads = new Map<string, { expires: number; text: Promise<string> }>();
function credentials() {
	return getRuntimeConfig().config.opensubtitles;
}
function credentialKey(config: Credentials) {
	return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}
async function request<T>(
	config: Credentials,
	path: string,
	body?: object,
	token?: string,
	base = API,
): Promise<T> {
	const response = await fetch(`${base}/${path}`, {
		method: body ? "POST" : "GET",
		headers: {
			"Api-Key": config.apiKey,
			"User-Agent": "torrent-stream v1.0",
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
		cache: "no-store",
		signal: AbortSignal.timeout(12000),
	});
	if (!response.ok) {
		const message =
			response.status === 401 || response.status === 403
				? "Check your OpenSubtitles API key and account credentials in Settings."
				: response.status === 406 || response.status === 429
					? "OpenSubtitles download or request limit reached. Try again later."
					: "OpenSubtitles is temporarily unavailable.";
		throw new SubtitleError(message, response.status);
	}
	return response.json();
}
async function login(config: Credentials) {
	const key = credentialKey(config);
	if (session?.key === key && session.expires > Date.now()) return session;
	const result = await request<{ token: string; base_url?: string }>(
		config,
		"login",
		{ username: config.username, password: config.password },
	);
	if (!result.token) throw new SubtitleError("OpenSubtitles login failed.");
	// Never forward credentials to a host outside OpenSubtitles.
	const base =
		result.base_url === "vip-api.opensubtitles.com"
			? "https://vip-api.opensubtitles.com/api/v1"
			: API;
	session = {
		key,
		expires: Date.now() + 6 * 60 * 60 * 1000,
		token: result.token,
		base,
	};
	return session;
}
interface SearchResult {
	data: {
		attributes: {
			language: string;
			release?: string;
			hearing_impaired?: boolean;
			files: { file_id: number; file_name: string }[];
		};
	}[];
}
export async function searchOpenSubtitles(
	imdbId: string,
	season?: number,
	episode?: number,
): Promise<{
	subtitles: NonNullable<StremioStream["subtitles"]>;
	error?: string;
}> {
	const config = credentials();
	if (!config.apiKey) return { subtitles: [] };
	const params = new URLSearchParams({
		...(episode !== undefined
			? {
					type: "episode",
					parent_imdb_id: imdbId.replace(/^tt/, ""),
					season_number: String(season),
					episode_number: String(episode),
				}
			: { type: "movie", imdb_id: imdbId.replace(/^tt/, "") }),
		order_by: "download_count",
		order_direction: "desc",
	});
	const languages = getRuntimeConfig().config.search.languages;
	if (languages.length) params.set("languages", languages.join(","));
	params.sort();
	try {
		const result = await request<SearchResult>(config, `subtitles?${params}`);
		const seen = new Set<number>();
		const subtitles: NonNullable<StremioStream["subtitles"]> = [];
		for (const { attributes } of result.data || []) {
			for (const file of attributes.files || []) {
				if (
					!Number.isSafeInteger(file.file_id) ||
					file.file_id <= 0 ||
					seen.has(file.file_id)
				)
					continue;
				seen.add(file.file_id);
				subtitles.push({
					id: `opensubtitles-${file.file_id}`,
					url: `/api/subtitles/${file.file_id}`,
					lang: attributes.language,
					label:
						file.file_name || attributes.release || `Subtitle ${file.file_id}`,
					hearingImpaired: attributes.hearing_impaired,
					format: "srt",
				});
			}
		}
		return { subtitles: subtitles.slice(0, 50) };
	} catch (error) {
		return { subtitles: [], error: subtitleErrorMessage(error) };
	}
}
async function download(
	config: Credentials,
	id: number,
	retry = true,
): Promise<string> {
	const auth =
		config.username && config.password ? await login(config) : undefined;
	let result: { link: string };
	try {
		result = await request(
			config,
			"download",
			{ file_id: id, sub_format: "srt" },
			auth?.token,
			auth?.base,
		);
	} catch (error) {
		if (
			retry &&
			auth &&
			error instanceof SubtitleError &&
			error.status === 401
		) {
			session = undefined;
			return download(config, id, false);
		}
		throw error;
	}
	let url = new URL(result.link);
	let response: Response | undefined;
	for (let redirect = 0; redirect < 4; redirect++) {
		if (
			url.protocol !== "https:" ||
			!(
				url.hostname === "opensubtitles.com" ||
				url.hostname.endsWith(".opensubtitles.com")
			)
		) {
			throw new SubtitleError(
				"OpenSubtitles returned an invalid download URL.",
			);
		}
		response = await fetch(url, {
			signal: AbortSignal.timeout(15000),
			cache: "no-store",
			redirect: "manual",
		});
		if (![301, 302, 303, 307, 308].includes(response.status)) break;
		const location = response.headers.get("location");
		await response.body?.cancel();
		if (!location)
			throw new SubtitleError(
				"OpenSubtitles returned an invalid download redirect.",
			);
		url = new URL(location, url);
	}

	if (!response?.ok)
		throw new SubtitleError("Could not download the selected subtitle.");
	const text = await response.text();
	if (text.length > 5_000_000 || !text.includes("-->"))
		throw new SubtitleError("OpenSubtitles returned an invalid subtitle file.");
	return text;
}
export async function downloadOpenSubtitle(id: number) {
	const config = credentials();
	if (!config.apiKey)
		throw new SubtitleError("Add an OpenSubtitles API key in Settings.");
	const key = `${credentialKey(config)}:${id}`;
	const cached = downloads.get(key);
	if (cached && cached.expires > Date.now()) return cached.text;
	for (const [key, value] of downloads)
		if (value.expires <= Date.now()) downloads.delete(key);
	if (downloads.size >= 50)
		downloads.delete(downloads.keys().next().value as string);
	const text = download(config, id).catch((error) => {
		downloads.delete(key);
		throw error;
	});
	downloads.set(key, { expires: Date.now() + 24 * 60 * 60 * 1000, text });
	return text;
}
export function subtitleErrorMessage(error: unknown) {
	return error instanceof SubtitleError
		? error.message
		: "Could not reach OpenSubtitles. Please try again later.";
}
