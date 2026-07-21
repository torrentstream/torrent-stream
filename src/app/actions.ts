"use server";

import { getRuntimeConfig, saveRuntimeConfig } from "@/lib/config/runtime";
import { parseRuntimeConfig, type RuntimeConfig } from "@/lib/config/schema";
import { getReadableSize } from "@/lib/media/file";
import { getProviderName, providers } from "@/lib/search/provider-registry";
import { getTorrentClient } from "@/lib/torrent/clients";
import { TorrentInfo } from "@/lib/torrent/info";
import {
	applyRuntimeTorrentConfig,
	destroyTorrent,
	getSeedStats,
	getStreams,
	getTorrentProvider,
} from "@/lib/torrent/streams";

export interface TorrentStats {
	torrents: {
		name: string;
		provider: string;
		infoHash: string;
		streams: number;
		peers: number;
		size: string;
		progress: string;
		downloaded: string;
		uploaded: string;
		downloadSpeed: string;
		uploadSpeed: string;
		seeding: boolean;
		ratio?: string;
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
			streamed: boolean;
		}[];
	}[];
	showProgress: boolean;
	showDeleteFiles: boolean;
}

export async function getTorrents(): Promise<TorrentStats> {
	const torrentClient = getTorrentClient();
	return {
		torrents: torrentClient.torrents
			.filter((torrent) => torrent.ready)
			.toReversed()
			.map((torrent) => {
				const info = new TorrentInfo(torrent);
				const seed = getSeedStats(torrent);
				return {
					name: info.name,
					provider: getProviderName(getTorrentProvider(torrent)),
					infoHash: info.infoHash,
					streams: info.streams,
					peers: info.peers,
					size: info.readableSize,
					progress: info.readableProgress,
					downloaded: seed
						? getReadableSize(seed.downloaded)
						: info.readableDownloaded,
					uploaded: seed
						? getReadableSize(seed.uploaded)
						: info.readableUploaded,
					downloadSpeed: info.readableDownloadSpeed,
					uploadSpeed: info.readableUploadSpeed,
					seeding: seed?.seeding ?? false,
					ratio: seed?.ratio.toFixed(2),
					historicalSpeeds: info.historicalSpeeds,
					files: info.files
						.filter((file) => file.streamed)
						.map((file) => ({
							name: file.name,
							path: file.path,
							size: file.readableSize,
							progress: file.readableProgress,
							downloaded: file.readableDownloaded,
							isVideo: file.isVideo,
							isSubtitle: file.isSubtitle,
							streams: file.streams,
							streamed: file.streamed,
						}))
						.sort((a, b) => a.path.localeCompare(b.path)),
				};
			}),
		showProgress: getRuntimeConfig().config.storage.mode === "file",
		showDeleteFiles:
			getRuntimeConfig().config.storage.mode === "file" &&
			getRuntimeConfig().config.storage.keepFiles,
	};
}

export async function removeTorrent(
	infoHash: string,
	deleteFiles?: boolean,
): Promise<void> {
	const torrent = await getTorrentClient().get(infoHash);
	if (!torrent) return;
	await destroyTorrent(torrent, deleteFiles);
}

export async function getConfiguration() {
	return {
		...getRuntimeConfig(),
		providerOptions: providers.map((provider) => ({
			id: provider.id,
			name: provider.name,
			trackers: provider.trackers,
		})),
	};
}

export type SaveConfigurationResult =
	| {
			requiresConfirmation: true;
			activeStreams: number;
			activeTorrents: number;
	  }
	| {
			requiresConfirmation: false;
			config: RuntimeConfig;
			revision: string;
			clientRestarted: boolean;
			interruptedStreams: number;
	  };

export async function saveConfiguration(
	value: unknown,
	expectedRevision: string,
	confirmRestart = false,
): Promise<SaveConfigurationResult> {
	const next = parseRuntimeConfig(value);
	const previous = getRuntimeConfig();
	const storageRestartRequired =
		previous.config.storage.mode !== next.storage.mode ||
		previous.config.storage.path !== next.storage.path;

	if (storageRestartRequired && !confirmRestart) {
		const torrentClient = getTorrentClient();
		return {
			requiresConfirmation: true,
			activeStreams: torrentClient.torrents.reduce(
				(total, torrent) => total + getStreams(torrent).length,
				0,
			),
			activeTorrents: torrentClient.torrents.length,
		};
	}

	const saved = saveRuntimeConfig(next, expectedRevision);
	const applied = await applyRuntimeTorrentConfig(previous.config);
	return {
		requiresConfirmation: false,
		config: saved.config,
		revision: saved.revision,
		...applied,
	};
}
