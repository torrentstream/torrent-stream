import { parseEnum, tryParseEnum } from "./enum";
import { TorrentFormat } from "./format";

export enum LogLevel {
	Fatal = "fatal",
	Error = "error",
	Warn = "warn",
	Info = "info",
	Debug = "debug",
	Trace = "trace",
	Silent = "silent",
}

export enum TorrentStorageMode {
	Memory = "memory",
	File = "file",
}

function parseLimit(value: string | undefined) {
	if (!value) return -1;
	const parsed = Number(value);
	return Number.isNaN(parsed) ? -1 : parsed;
}

export const config = {
	port: Number(process.env.PORT) || 3000,
	dev: process.env.NODE_ENV !== "production",
	logLevel: parseEnum(LogLevel, process.env.LOG_LEVEL, LogLevel.Info),
	encryptionKey: process.env.ENCRYPTION_KEY || "torrent_stream_default_key",
	torrentStorageMode: parseEnum(
		TorrentStorageMode,
		process.env.TORRENT_STORAGE_MODE,
		TorrentStorageMode.Memory,
	),
	streamMemoryLimit:
		Number(process.env.STREAM_MEMORY_LIMIT) || 128 * 1024 * 1024,
	torrentStoragePath: process.env.TORRENT_STORAGE_PATH || "/data",
	torrentStatePath: process.env.TORRENT_STATE_PATH || "/state",
	torrentKeepFiles: process.env.TORRENT_KEEP_FILES === "true",
	torrentIdleDownload: process.env.TORRENT_IDLE_DOWNLOAD === "true",
	torrentSeedRatio: Number(process.env.TORRENT_SEED_RATIO) || 0,
	torrentSeedTime: Number(process.env.TORRENT_SEED_TIME) || 0,
	torrentSeedTimeIncrement:
		Number(process.env.TORRENT_SEED_TIME_INCREMENT) || 0,
	torrentSeedTimeIncrementBytes:
		Number(process.env.TORRENT_SEED_TIME_INCREMENT_BYTES) || 0,
	torrentSeedTimeRatioDiscount:
		process.env.TORRENT_SEED_TIME_RATIO_DISCOUNT === "true",
	torrentDownloadLimit: parseLimit(process.env.TORRENT_DOWNLOAD_LIMIT),
	torrentUploadLimit: parseLimit(process.env.TORRENT_UPLOAD_LIMIT),
	torrentAddTimeout: Number(process.env.TORRENT_ADD_TIMEOUT) || 5 * 1000,
	torrentIdleTimeout: Number(process.env.TORRENT_IDLE_TIMEOUT) || 60 * 1000,
	torrentRemoveTimeout:
		Number(process.env.TORRENT_REMOVE_TIMEOUT) || 5 * 60 * 1000,
	torrentProviders:
		process.env.TORRENT_PROVIDERS?.split(",")
			.map((provider) => provider.trim())
			.filter(Boolean) ?? [],
	torrentSeedProviderWhitelist:
		process.env.TORRENT_SEED_PROVIDER_WHITELIST?.split(",")
			.map((provider) => provider.trim())
			.filter(Boolean) ?? [],
	torrentFormats: (process.env.TORRENT_FORMATS?.split(",")
		.map((format) => tryParseEnum(TorrentFormat, format, TorrentFormat.Unknown))
		.filter(Boolean) as TorrentFormat[]) ?? [
		TorrentFormat["4K"],
		TorrentFormat["1080p"],
		TorrentFormat["720p"],
		TorrentFormat.DolbyVision,
		TorrentFormat.HDR,
		TorrentFormat.UHDBluRay,
		TorrentFormat.BluRay,
		TorrentFormat.Remux,
		TorrentFormat.Web,
		TorrentFormat.DVD,
		TorrentFormat.HDTV,
		TorrentFormat.SDTV,
		TorrentFormat.Screener,
		TorrentFormat.Cam,
		TorrentFormat["3D"],
		TorrentFormat.Unknown,
		TorrentFormat.AV1,
		TorrentFormat.HEVC,
		TorrentFormat.AVC,
		TorrentFormat.DivX,
		TorrentFormat.Xvid,
	],
	torrentLanguages: process.env.TORRENT_LANGUAGES?.split(",") ?? [],
	webRequestTimeout: Number(process.env.WEB_REQUEST_TIMEOUT) || 5 * 1000,
	ncoreUser: process.env.NCORE_USER,
	ncorePass: process.env.NCORE_PASS,
	insaneUser: process.env.INSANE_USER,
	insanePass: process.env.INSANE_PASS,
};
