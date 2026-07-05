import { TorrentFormat } from "./format";
import { supportedLanguages } from "./language";

export const providerIds = [
	"ncore",
	"insane",
	"torrentio",
] as const satisfies readonly ProviderId[];

export const searchSortCriteria = [
	"quality",
	"seeds",
	"language",
	"provider",
] as const;
export type SearchSortCriterion = (typeof searchSortCriteria)[number];
export type TorrentStorageMode = "memory" | "file";

export interface TorrentioProviderConfig {
	enabled: boolean;
	allTrackers: boolean;
	sources: string[];
}

export type RuntimeProviders = {
	torrentio: TorrentioProviderConfig;
	ncore: {
		enabled: boolean;
		username: string;
		password: string;
		seeding: boolean;
	};
	insane: {
		enabled: boolean;
		username: string;
		password: string;
		seeding: boolean;
	};
};

export type ProviderId = keyof RuntimeProviders;

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
				seeding: true,
			},
			insane: {
				enabled: false,
				username: "",
				password: "",
				seeding: true,
			},
			torrentio: {
				enabled: true,
				allTrackers: true,
				sources: [],
			},
		},
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

	const torrentio = object(providers.torrentio);
	const configuredSources = torrentio.sources;
	const parsedSourceList =
		Array.isArray(configuredSources) &&
		configuredSources.every((source) => typeof source === "string")
			? [...new Set(configuredSources)]
			: [...defaults.providers.torrentio.sources];
	const parsedTorrentio = {
		enabled: boolean(torrentio.enabled, defaults.providers.torrentio.enabled),
		allTrackers: boolean(
			torrentio.allTrackers,
			defaults.providers.torrentio.allTrackers,
		),
		sources: parsedSourceList,
	};

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
				seeding: boolean(ncore.seeding, defaults.providers.ncore.seeding),
			},
			insane: {
				enabled: boolean(insane.enabled, defaults.providers.insane.enabled),
				username: string(insane.username, defaults.providers.insane.username),
				password: string(insane.password, defaults.providers.insane.password),
				seeding: boolean(insane.seeding, defaults.providers.insane.seeding),
			},
			torrentio: parsedTorrentio,
		},
	};
}

export function isProviderEnabled(config: RuntimeConfig, provider: ProviderId) {
	return config.providers[provider].enabled;
}

export function isProviderSeedingEnabled(
	config: RuntimeConfig,
	provider: ProviderId,
) {
	const providerConfig = config.providers[provider];
	return "seeding" in providerConfig && providerConfig.seeding;
}
