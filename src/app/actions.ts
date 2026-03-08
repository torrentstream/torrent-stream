"use server";

import { config, TorrentStorageMode } from "@/lib/config";
import { torrentClient } from "@/lib/torrent/clients";
import { unregisterTorrent } from "@/lib/torrent/streams";
import { TorrentInfo } from "@/lib/torrent/types";

export interface TorrentStats {
	torrents: {
		name: string;
		infoHash: string;
		streams: number;
		peers: number;
		size: string;
		progress: string;
		downloaded: string;
		uploaded: string;
		downloadSpeed: string;
		uploadSpeed: string;
		historicalSpeeds: {
			date: Date;
			download: number;
			upload: number;
		}[];
		files: {
			name: string;
			path: string;
			size: string;
			progress: string;
			downloaded: string;
			isVideo: boolean;
			isSubtitle: boolean;
			streams: number;
		}[];
	}[];
	showProgress: boolean;
}

export async function getTorrents(): Promise<TorrentStats> {
	return {
		torrents: torrentClient.torrents
			.filter((torrent) => torrent.ready)
			.toReversed()
			.map((torrent) => {
				const info = new TorrentInfo(torrent);
				return {
					name: info.name,
					infoHash: info.infoHash,
					streams: info.streams,
					peers: info.peers,
					size: info.readableSize,
					progress: info.readableProgress,
					downloaded: info.readableDownloaded,
					uploaded: info.readableUploaded,
					downloadSpeed: info.readableDownloadSpeed,
					uploadSpeed: info.readableUploadSpeed,
					historicalSpeeds: info.historicalSpeeds,
					files: info.files
						.map((file) => ({
							name: file.name,
							path: file.path,
							size: file.readableSize,
							progress: file.readableProgress,
							downloaded: file.readableDownloaded,
							isVideo: file.isVideo,
							isSubtitle: file.isSubtitle,
							streams: file.streams,
						}))
						.sort((a, b) => a.path.localeCompare(b.path)),
				};
			}),
		showProgress: config.torrentStorageMode === TorrentStorageMode.File,
	};
}

export async function removeTorrent(infoHash: string): Promise<void> {
	const torrent = await torrentClient.get(infoHash);
	if (!torrent) return;
	return new Promise((resolve) => {
		torrent.destroy(undefined, () => {
			unregisterTorrent(torrent);
			resolve();
		});
	});
}
