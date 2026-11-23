import WebTorrent from "webtorrent";
import { deploymentConfig, getRuntimeConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";

declare global {
	var torrentClientInstance: WebTorrent | undefined;
	var infoClientInstance: WebTorrent | undefined;
}

function isDestroyed(client: WebTorrent | undefined) {
	return Boolean(
		(client as (WebTorrent & { destroyed?: boolean }) | undefined)?.destroyed,
	);
}

function attachMainClientErrorHandler(client: WebTorrent) {
	client.on("error", (error) => {
		if (
			error instanceof Error &&
			error.message.startsWith("Cannot add duplicate torrent")
		) {
			return;
		}
		logger.error(error);
	});
}

function createTorrentClient() {
	const { downloadLimit, uploadLimit } = getRuntimeConfig().config.torrent;
	// Peers connect to this port (TCP and uTP); the info client and DHT keep
	// random ports, since two sockets cannot share it.
	const client = new WebTorrent({
		downloadLimit,
		uploadLimit,
		torrentPort: deploymentConfig.torrentPort,
	});
	attachMainClientErrorHandler(client);
	return client;
}

function createInfoClient() {
	const client = new WebTorrent();
	client.on("error", () => {});
	return client;
}

export function getTorrentClient() {
	if (
		!global.torrentClientInstance ||
		isDestroyed(global.torrentClientInstance)
	) {
		global.torrentClientInstance = createTorrentClient();
	}
	return global.torrentClientInstance;
}

export function getInfoClient() {
	if (!global.infoClientInstance || isDestroyed(global.infoClientInstance)) {
		global.infoClientInstance = createInfoClient();
	}
	return global.infoClientInstance;
}

export function applyTransferLimits() {
	const { downloadLimit, uploadLimit } = getRuntimeConfig().config.torrent;
	const client = getTorrentClient();
	client.throttleDownload(downloadLimit);
	client.throttleUpload(uploadLimit);
}
