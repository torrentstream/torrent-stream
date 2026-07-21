import MemoryChunkStore from "memory-chunk-store";
import type { Torrent, TorrentFile } from "webtorrent";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { createLimit } from "@/lib/limit";
import { LRU } from "@/lib/lru";
import { getEpisodeNumber } from "@/lib/media/episode";
import {
	getReadableProgress,
	getReadableSize,
	getReadableSpeed,
	isSubtitleFile,
	isVideoFile,
} from "@/lib/media/file";
import { getFormats, type TorrentFormat } from "@/lib/media/format";
import { getInfoClient } from "./clients";
import { getHistoricalSpeeds, getStreamedFiles, getStreams } from "./streams";

const torrentInfoCache = new LRU<string, Promise<TorrentInfo | undefined>>(500);
const limitFetchTorrentInfo = createLimit(10);

export function getTorrentInfo(uri: string) {
	const cached = torrentInfoCache.get(uri);
	if (cached) return cached;

	const promise = limitFetchTorrentInfo(() => fetchTorrentInfo(uri)).then(
		(info) => {
			if (!info) torrentInfoCache.delete(uri);
			return info;
		},
	);

	torrentInfoCache.put(uri, promise);
	return promise;
}

function fetchTorrentInfo(uri: string) {
	return new Promise<TorrentInfo | undefined>((resolve) => {
		let completed = false;

		const onTorrent = (torrent: Torrent) => {
			if (completed) return;
			if (torrent.destroyed) {
				completed = true;
				clearTimeout(timeout);
				resolve(undefined);
				return;
			}
			if (!torrent.ready) {
				torrent.once("ready", () => onTorrent(torrent));
				return;
			}
			completed = true;
			clearTimeout(timeout);
			const info = new TorrentInfo(torrent);
			torrent.destroy();
			resolve(info);
		};

		const torrent = getInfoClient().add(
			uri,
			{
				store: MemoryChunkStore,
				destroyStoreOnDestroy: true,
			},
			onTorrent,
		);

		const timeout = setTimeout(() => {
			if (completed) return;
			completed = true;
			torrent.destroy();
			resolve(undefined);
		}, getRuntimeConfig().config.torrent.addTimeout);
	});
}

export class TorrentInfo {
	name: string;
	infoHash: string;
	size: number;
	readableSize: string;
	progress: number;
	readableProgress: string;
	downloaded: number;
	readableDownloaded: string;
	uploaded: number;
	readableUploaded: string;
	downloadSpeed: number;
	readableDownloadSpeed: string;
	uploadSpeed: number;
	readableUploadSpeed: string;
	historicalSpeeds: { date: Date; download: number; upload: number }[];
	peers: number;
	streams: number;
	files: TorrentFileInfo[];

	constructor(torrent: Torrent) {
		this.name = torrent.name;
		this.infoHash = torrent.infoHash;
		this.size = torrent.length;
		this.readableSize = getReadableSize(this.size);
		this.progress = torrent.progress;
		this.readableProgress = getReadableProgress(this.progress);
		this.downloaded = torrent.downloaded;
		this.readableDownloaded = getReadableSize(this.downloaded);
		this.uploaded = torrent.uploaded;
		this.readableUploaded = getReadableSize(this.uploaded);
		this.downloadSpeed = torrent.downloadSpeed;
		this.readableDownloadSpeed = getReadableSpeed(this.downloadSpeed);
		this.uploadSpeed = torrent.uploadSpeed;
		this.readableUploadSpeed = getReadableSpeed(this.uploadSpeed);
		this.historicalSpeeds = getHistoricalSpeeds(torrent);
		this.peers = torrent.numPeers;
		this.streams = getStreams(torrent).length;
		this.files = torrent.files.map(
			(file) => new TorrentFileInfo(torrent, file),
		);
	}
}

export class TorrentFileInfo {
	name: string;
	index: number;
	path: string;
	size: number;
	readableSize: string;
	progress: number;
	readableProgress: string;
	downloaded: number;
	readableDownloaded: string;
	formats: { formats: TorrentFormat[]; quality: string; score: number };
	streams: number;
	streamed: boolean;
	isVideo: boolean;
	isSubtitle: boolean;

	constructor(torrent: Torrent, file: TorrentFile) {
		this.name = file.name;
		this.index = torrent.files.indexOf(file);
		this.path = file.path;
		this.size = file.length;
		this.readableSize = getReadableSize(this.size);
		this.progress = file.progress;
		this.readableProgress = getReadableProgress(this.progress);
		this.downloaded = file.downloaded;
		this.readableDownloaded = getReadableSize(this.downloaded);
		this.formats = getFormats(this.name);
		this.streams = getStreams(torrent).filter((stream) =>
			stream.files.has(this.path),
		).length;
		this.streamed =
			this.streams > 0 || getStreamedFiles(torrent).has(this.path);
		this.isVideo = isVideoFile(this.name);
		this.isSubtitle = isSubtitleFile(this.name);
	}

	isCorrectEpisode(season: number, episode: number) {
		const guess = getEpisodeNumber(this.name);
		if (guess.season === season && guess.episode === episode) return true;
		if (season === 0) return true;
		return false;
	}
}
