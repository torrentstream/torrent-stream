import { TorrentFormat } from "./format";
import { supportedLanguages } from "./language";

export const torrentioSourceIds = [
	"yts",
	"eztv",
	"rarbg",
	"1337x",
	"thepiratebay",
	"kickasstorrents",
	"torrentgalaxy",
	"magnetdl",
	"horriblesubs",
	"nyaasi",
	"tokyotosho",
	"anidex",
	"rutor",
	"rutracker",
	"comando",
	"bludv",
	"micoleaodublado",
	"torrent9",
	"ilcorsaronero",
	"mejortorrent",
	"wolfmax4k",
	"cinecalidad",
	"besttorrents",
] as const;

export type TorrentioSourceId = (typeof torrentioSourceIds)[number];
export const providerIds = [
	"ncore",
	"insane",
	"torrentio",
	...torrentioSourceIds,
] as const;
export type ProviderId = (typeof providerIds)[number];
export const searchSortCriteria = [
	"quality",
	"seeds",
	"language",
	"provider",
] as const;
export type SearchSortCriterion = (typeof searchSortCriteria)[number];
export type TorrentStorageMode = "memory" | "file";

export interface SeedPolicy {
	enabled: boolean;
	ratio: number;
	timeSeconds: number;
	timeIncrementSeconds: number;
	timeIncrementBytes: number;
	ratioDiscount: boolean;
}

export interface PublicProviderConfig {
	enabled: boolean;
	seed: SeedPolicy;
}

export type RuntimeProviders = {
	torrentio: PublicProviderConfig;
	ncore: {
		enabled: boolean;
		username: string;
		password: string;
		seed: SeedPolicy;
	};
	insane: {
		enabled: boolean;
		username: string;
		password: string;
		seed: SeedPolicy;
	};
} & Record<TorrentioSourceId, PublicProviderConfig>;

export interface RuntimeConfig {
	storage: {
		mode: TorrentStorageMode;
		path: string;
		streamMemoryLimit: number;
		keepFiles: boolean;
		idleDownload: boolean;
	};
	torrent: {
		downloadLimit: number;
		uploadLimit: number;
		addTimeout: number;
		idleTimeout: number;
		removeTimeout: number;
	};
	search: {
		requestTimeout: number;
		formats: TorrentFormat[];
		languages: string[];
		sortPriority: SearchSortCriterion[];
		providerOrder: ProviderId[];
	};
	providers: RuntimeProviders;
}

export const emptySeedPolicy = (): SeedPolicy => ({
	enabled: false,
	ratio: 1,
	timeSeconds: 0,
	timeIncrementSeconds: 0,
	timeIncrementBytes: 0,
	ratioDiscount: false,
});

export function createDefaultRuntimeConfig(): RuntimeConfig {
	return {
		storage: {
			mode: "memory",
			path: "/data",
			streamMemoryLimit: 128 * 1024 * 1024,
			keepFiles: false,
			idleDownload: false,
		},
		torrent: {
			downloadLimit: -1,
			uploadLimit: -1,
			addTimeout: 5 * 1000,
			idleTimeout: 60 * 1000,
			removeTimeout: 5 * 60 * 1000,
		},
		search: {
			requestTimeout: 5 * 1000,
			formats: Object.values(TorrentFormat),
			languages: ["en", "hu"],
			sortPriority: [...searchSortCriteria],
			providerOrder: [...providerIds],
		},
		providers: {
			ncore: {
				enabled: false,
				username: "",
				password: "",
				seed: {
					enabled: true,
					ratio: 1,
					timeSeconds: 48 * 60 * 60,
					timeIncrementSeconds: 0.4 * 60 * 60,
					timeIncrementBytes: 1024 ** 3,
					ratioDiscount: true,
				},
			},
			insane: {
				enabled: false,
				username: "",
				password: "",
				seed: {
					enabled: true,
					ratio: 1,
					timeSeconds: 24 * 60 * 60,
					timeIncrementSeconds: 0,
					timeIncrementBytes: 1024 ** 3,
					ratioDiscount: true,
				},
			},
			torrentio: {
				enabled: true,
				seed: emptySeedPolicy(),
			},
			...Object.fromEntries(
				torrentioSourceIds.map((id) => [
					id,
					{ enabled: false, seed: emptySeedPolicy() },
				]),
			),
		} as RuntimeProviders,
	};
}

function object(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function boolean(value: unknown, fallback: boolean) {
	return typeof value === "boolean" ? value : fallback;
}

function string(value: unknown, fallback: string) {
	return typeof value === "string" ? value : fallback;
}

function nonEmptyString(value: unknown, fallback: string) {
	const parsed = string(value, fallback).trim();
	return parsed || fallback;
}

function number(
	value: unknown,
	fallback: number,
	{ min = 0, integer = false }: { min?: number; integer?: boolean } = {},
) {
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		value < min ||
		(integer && !Number.isInteger(value))
	) {
		return fallback;
	}
	return value;
}

function transferLimit(value: unknown, fallback: number) {
	return number(value, fallback, { min: -1, integer: true });
}

function parseOrder<T extends string>(
	value: unknown,
	allowed: readonly T[],
	fallback: readonly T[],
) {
	if (
		!Array.isArray(value) ||
		value.length !== allowed.length ||
		!value.every(
			(item) => typeof item === "string" && allowed.includes(item as T),
		) ||
		new Set(value).size !== allowed.length
	) {
		return [...fallback];
	}
	return [...value] as T[];
}

function parseSeedPolicy(value: unknown, fallback: SeedPolicy): SeedPolicy {
	const seed = object(value);
	const parsed = {
		enabled: boolean(seed.enabled, fallback.enabled),
		ratio: number(seed.ratio, fallback.ratio),
		timeSeconds: number(seed.timeSeconds, fallback.timeSeconds, {
			integer: true,
		}),
		timeIncrementSeconds: number(
			seed.timeIncrementSeconds,
			fallback.timeIncrementSeconds,
			{ integer: true },
		),
		timeIncrementBytes: number(
			seed.timeIncrementBytes,
			fallback.timeIncrementBytes,
			{ integer: true },
		),
		ratioDiscount: boolean(seed.ratioDiscount, fallback.ratioDiscount),
	};
	if (parsed.enabled && parsed.ratio === 0 && parsed.timeSeconds === 0) {
		parsed.ratio = fallback.ratio || 1;
	}
	if (parsed.timeIncrementSeconds > 0 && parsed.timeIncrementBytes === 0) {
		parsed.timeIncrementBytes = fallback.timeIncrementBytes;
		if (parsed.timeIncrementBytes === 0) {
			parsed.timeIncrementSeconds = fallback.timeIncrementSeconds;
		}
	}
	return parsed;
}

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
	const defaults = createDefaultRuntimeConfig();
	const root = object(value);
	const storage = object(root.storage);
	const torrent = object(root.torrent);
	const search = object(root.search);
	const providers = object(root.providers);

	const formats = search.formats;
	const parsedFormats =
		!Array.isArray(formats) ||
		!formats.every((format) =>
			Object.values(TorrentFormat).includes(format as TorrentFormat),
		)
			? [...defaults.search.formats]
			: ([...new Set(formats)] as TorrentFormat[]);

	const languages = search.languages;
	const supportedLanguageCodes = new Set(
		supportedLanguages.map(({ code }) => code),
	);
	const parsedLanguages =
		!Array.isArray(languages) ||
		!languages.every(
			(language) =>
				typeof language === "string" &&
				supportedLanguageCodes.has(
					language as (typeof supportedLanguages)[number]["code"],
				),
		)
			? [...defaults.search.languages]
			: [...new Set(languages)];
	const sortPriority = parseOrder(
		search.sortPriority,
		searchSortCriteria,
		defaults.search.sortPriority,
	);
	const providerOrder = parseOrder(
		search.providerOrder,
		providerIds,
		defaults.search.providerOrder,
	);

	const parsedSources = Object.fromEntries(
		torrentioSourceIds.map((id) => {
			const source = object(providers[id]);
			const fallback = defaults.providers[id];
			return [
				id,
				{
					enabled: boolean(source.enabled, fallback.enabled),
					seed: parseSeedPolicy(source.seed, fallback.seed),
				},
			];
		}),
	) as Record<TorrentioSourceId, PublicProviderConfig>;
	const torrentio = object(providers.torrentio);
	const parsedTorrentio = {
		enabled: boolean(torrentio.enabled, defaults.providers.torrentio.enabled),
		seed: parseSeedPolicy(torrentio.seed, defaults.providers.torrentio.seed),
	};
	if (parsedTorrentio.enabled) {
		for (const source of Object.values(parsedSources)) source.enabled = false;
	}

	const ncore = object(providers.ncore);
	const insane = object(providers.insane);
	return {
		storage: {
			mode:
				storage.mode === "memory" || storage.mode === "file"
					? storage.mode
					: defaults.storage.mode,
			path: nonEmptyString(storage.path, defaults.storage.path),
			streamMemoryLimit: number(
				storage.streamMemoryLimit,
				defaults.storage.streamMemoryLimit,
				{ integer: true },
			),
			keepFiles: boolean(storage.keepFiles, defaults.storage.keepFiles),
			idleDownload: boolean(
				storage.idleDownload,
				defaults.storage.idleDownload,
			),
		},
		torrent: {
			downloadLimit: transferLimit(
				torrent.downloadLimit,
				defaults.torrent.downloadLimit,
			),
			uploadLimit: transferLimit(
				torrent.uploadLimit,
				defaults.torrent.uploadLimit,
			),
			addTimeout: number(torrent.addTimeout, defaults.torrent.addTimeout, {
				integer: true,
			}),
			idleTimeout: number(torrent.idleTimeout, defaults.torrent.idleTimeout, {
				integer: true,
			}),
			removeTimeout: number(
				torrent.removeTimeout,
				defaults.torrent.removeTimeout,
				{ integer: true },
			),
		},
		search: {
			requestTimeout: number(
				search.requestTimeout,
				defaults.search.requestTimeout,
				{
					integer: true,
				},
			),
			formats: parsedFormats,
			languages: parsedLanguages,
			sortPriority,
			providerOrder,
		},
		providers: {
			ncore: {
				enabled: boolean(ncore.enabled, defaults.providers.ncore.enabled),
				username: string(ncore.username, defaults.providers.ncore.username),
				password: string(ncore.password, defaults.providers.ncore.password),
				seed: parseSeedPolicy(ncore.seed, defaults.providers.ncore.seed),
			},
			insane: {
				enabled: boolean(insane.enabled, defaults.providers.insane.enabled),
				username: string(insane.username, defaults.providers.insane.username),
				password: string(insane.password, defaults.providers.insane.password),
				seed: parseSeedPolicy(insane.seed, defaults.providers.insane.seed),
			},
			torrentio: parsedTorrentio,
			...parsedSources,
		} as RuntimeProviders,
	};
}

export function getProviderName(provider: string | undefined) {
	const names: Partial<Record<ProviderId, string>> = {
		ncore: "nCore",
		insane: "iNSANE",
		torrentio: "Torrentio",
		yts: "YTS",
		eztv: "EZTV",
		rarbg: "RARBG",
		"1337x": "1337x",
		thepiratebay: "The Pirate Bay",
		kickasstorrents: "KickassTorrents",
		torrentgalaxy: "TorrentGalaxy",
		magnetdl: "MagnetDL",
		horriblesubs: "HorribleSubs",
		nyaasi: "Nyaa.si",
		tokyotosho: "Tokyo Toshokan",
		anidex: "AniDex",
		rutor: "Rutor",
		rutracker: "RuTracker",
		comando: "Comando",
		bludv: "BluDV",
		micoleaodublado: "Mico Leão Dublado",
		torrent9: "Torrent9",
		ilcorsaronero: "Il Corsaro Nero",
		mejortorrent: "MejorTorrent",
		wolfmax4k: "WolfMax4K",
		cinecalidad: "CineCalidad",
		besttorrents: "BestTorrents",
	};
	if (!provider) return "Unknown";
	if (provider === "torrentio-unknown") return "Torrentio";
	return names[provider as ProviderId] ?? provider;
}

export function getSeedPolicy(
	config: RuntimeConfig,
	provider: string | undefined,
) {
	if (provider === "ncore") return config.providers.ncore.seed;
	if (provider === "insane") return config.providers.insane.seed;
	if (provider === "torrentio") return config.providers.torrentio.seed;
	if (provider && torrentioSourceIds.includes(provider as TorrentioSourceId)) {
		return config.providers[provider as TorrentioSourceId].seed;
	}
	return undefined;
}
