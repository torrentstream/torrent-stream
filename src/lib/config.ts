import { parseEnum } from "./enum";
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

export enum EncryptionAlgo {
	AES_128_CBC = "aes-128-cbc",
	AES_192_CBC = "aes-192-cbc",
	AES_256_CBC = "aes-256-cbc",
	AES_128_GCM = "aes-128-gcm",
	AES_192_GCM = "aes-192-gcm",
	AES_256_GCM = "aes-256-gcm",
}

export enum TorrentStorageMode {
	Memory = "memory",
	File = "file",
}

export const config = {
	port: Number(process.env.PORT) || 3000,
	dev: process.env.NODE_ENV !== "production",
	logLevel: parseEnum(LogLevel, process.env.LOG_LEVEL, LogLevel.Info),
	encryptionAlgo: parseEnum(
		EncryptionAlgo,
		process.env.ENCRYPTION_ALGO,
		EncryptionAlgo.AES_256_CBC,
	),
	encryptionKey: process.env.ENCRYPTION_KEY || "torrent_stream_default_key",
	torrentStorageMode: parseEnum(
		TorrentStorageMode,
		process.env.TORRENT_STORAGE_MODE,
		TorrentStorageMode.Memory,
	),
	torrentStoragePath: process.env.TORRENT_STORAGE_PATH || "/data",
	streamMemoryLimit:
		Number(process.env.STREAM_MEMORY_LIMIT) || 128 * 1024 * 1024,
	torrentDownloadLimit: Number(process.env.TORRENT_DOWNLOAD_LIMIT) || -1,
	torrentUploadLimit: Number(process.env.TORRENT_UPLOAD_LIMIT) || -1,
	torrentAddTimeout: Number(process.env.TORRENT_ADD_TIMEOUT) || 5 * 1000,
	torrentIdleTimeout: Number(process.env.TORRENT_IDLE_TIMEOUT) || 60 * 1000,
	torrentRemoveTimeout:
		Number(process.env.TORRENT_REMOVE_TIMEOUT) || 5 * 60 * 1000,
	torrentProviders: process.env.TORRENT_PROVIDERS?.split(",") ?? [],
	torrentFormats: process.env.TORRENT_FORMATS?.split(",") ?? [
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
