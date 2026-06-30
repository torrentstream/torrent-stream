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
	version: 4;
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
	};
	providers: RuntimeProviders;
}

export const emptySeedPolicy = (): SeedPolicy => ({
	enabled: false,
	ratio: 0,
	timeSeconds: 0,
	timeIncrementSeconds: 0,
	timeIncrementBytes: 1024 ** 3,
	ratioDiscount: false,
});

export function createDefaultRuntimeConfig(): RuntimeConfig {
	return {
		version: 4,
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
			languages: supportedLanguages.map(({ code }) => code),
		},
		providers: {
			ncore: {
				enabled: false,
				username: "",
				password: "",
				seed: emptySeedPolicy(),
			},
			insane: {
				enabled: false,
				username: "",
				password: "",
				seed: emptySeedPolicy(),
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

function object(value: unknown, name: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${name} must be an object`);
	}
	return value as Record<string, unknown>;
}

function boolean(value: unknown, name: string) {
	if (typeof value !== "boolean") throw new Error(`${name} must be a boolean`);
	return value;
}

function string(value: unknown, name: string) {
	if (typeof value !== "string") throw new Error(`${name} must be a string`);
	return value;
}

function number(
	value: unknown,
	name: string,
	{ min = 0, integer = false }: { min?: number; integer?: boolean } = {},
) {
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		value < min ||
		(integer && !Number.isInteger(value))
	) {
		throw new Error(
			`${name} must be ${integer ? "an integer" : "a number"} greater than or equal to ${min}`,
		);
	}
	return value;
}

function transferLimit(value: unknown, name: string) {
	return number(value, name, { min: -1, integer: true });
}

function parseSeedPolicy(value: unknown, name: string): SeedPolicy {
	const seed = object(value, name);
	const parsed = {
		enabled: boolean(seed.enabled, `${name}.enabled`),
		ratio: number(seed.ratio, `${name}.ratio`),
		timeSeconds: number(seed.timeSeconds, `${name}.timeSeconds`, {
			integer: true,
		}),
		timeIncrementSeconds: number(
			seed.timeIncrementSeconds,
			`${name}.timeIncrementSeconds`,
			{ integer: true },
		),
		timeIncrementBytes: number(
			seed.timeIncrementBytes,
			`${name}.timeIncrementBytes`,
			{ integer: true },
		),
		ratioDiscount: boolean(seed.ratioDiscount, `${name}.ratioDiscount`),
	};
	if (parsed.enabled && parsed.ratio === 0 && parsed.timeSeconds === 0) {
		throw new Error(`${name} needs a ratio or time target`);
	}
	if (parsed.timeIncrementSeconds > 0 && parsed.timeIncrementBytes === 0) {
		throw new Error(`${name}.timeIncrementBytes must be positive`);
	}
	return parsed;
}

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
	const root = object(value, "config");
	if (root.version !== 4) throw new Error("Unsupported config version");

	const storage = object(root.storage, "storage");
	if (storage.mode !== "memory" && storage.mode !== "file") {
		throw new Error("storage.mode must be memory or file");
	}

	const torrent = object(root.torrent, "torrent");
	const search = object(root.search, "search");
	const providers = object(root.providers, "providers");
	const torrentio = object(providers.torrentio, "providers.torrentio");
	const ncore = object(providers.ncore, "providers.ncore");
	const insane = object(providers.insane, "providers.insane");

	const formats = search.formats;
	if (
		!Array.isArray(formats) ||
		!formats.every((format) =>
			Object.values(TorrentFormat).includes(format as TorrentFormat),
		)
	) {
		throw new Error("search.formats contains an unsupported format");
	}

	const languages = search.languages;
	if (
		!Array.isArray(languages) ||
		!languages.every(
			(language) => typeof language === "string" && /^[a-z]{2}$/.test(language),
		)
	) {
		throw new Error("search.languages must contain two-letter language codes");
	}

	const torrentioEnabled = boolean(
		torrentio.enabled,
		"providers.torrentio.enabled",
	);
	const parsedSources = Object.fromEntries(
		torrentioSourceIds.map((id) => {
			const source = object(providers[id], `providers.${id}`);
			return [
				id,
				{
					enabled: boolean(source.enabled, `providers.${id}.enabled`),
					seed: parseSeedPolicy(source.seed, `providers.${id}.seed`),
				},
			];
		}),
	) as Record<TorrentioSourceId, PublicProviderConfig>;
	if (
		torrentioEnabled &&
		Object.values(parsedSources).some((source) => source.enabled)
	) {
		throw new Error(
			"Torrentio and individual Torrentio sources cannot be enabled together",
		);
	}

	return {
		version: 4,
		storage: {
			mode: storage.mode,
			path: string(storage.path, "storage.path").trim(),
			streamMemoryLimit: number(
				storage.streamMemoryLimit,
				"storage.streamMemoryLimit",
				{ integer: true },
			),
			keepFiles: boolean(storage.keepFiles, "storage.keepFiles"),
			idleDownload: boolean(storage.idleDownload, "storage.idleDownload"),
		},
		torrent: {
			downloadLimit: transferLimit(
				torrent.downloadLimit,
				"torrent.downloadLimit",
			),
			uploadLimit: transferLimit(torrent.uploadLimit, "torrent.uploadLimit"),
			addTimeout: number(torrent.addTimeout, "torrent.addTimeout", {
				integer: true,
			}),
			idleTimeout: number(torrent.idleTimeout, "torrent.idleTimeout", {
				integer: true,
			}),
			removeTimeout: number(torrent.removeTimeout, "torrent.removeTimeout", {
				integer: true,
			}),
		},
		search: {
			requestTimeout: number(search.requestTimeout, "search.requestTimeout", {
				integer: true,
			}),
			formats: [...new Set(formats)] as TorrentFormat[],
			languages: [...new Set(languages)],
		},
		providers: {
			ncore: {
				enabled: boolean(ncore.enabled, "providers.ncore.enabled"),
				username: string(ncore.username, "providers.ncore.username"),
				password: string(ncore.password, "providers.ncore.password"),
				seed: parseSeedPolicy(ncore.seed, "providers.ncore.seed"),
			},
			insane: {
				enabled: boolean(insane.enabled, "providers.insane.enabled"),
				username: string(insane.username, "providers.insane.username"),
				password: string(insane.password, "providers.insane.password"),
				seed: parseSeedPolicy(insane.seed, "providers.insane.seed"),
			},
			torrentio: {
				enabled: torrentioEnabled,
				seed: parseSeedPolicy(torrentio.seed, "providers.torrentio.seed"),
			},
			...parsedSources,
		} as RuntimeProviders,
	};
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
