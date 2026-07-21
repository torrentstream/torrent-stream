import type { Instance } from "webtorrent";
import WebTorrent from "webtorrent";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";

declare global {
	var torrentClientInstance: Instance | undefined;
	var infoClientInstance: Instance | undefined;
}

function isDestroyed(client: Instance | undefined) {
	return Boolean(
		(client as (Instance & { destroyed?: boolean }) | undefined)?.destroyed,
	);
}

function attachMainClientErrorHandler(client: Instance) {
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
	const client = new WebTorrent({ downloadLimit, uploadLimit });
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

function destroyClient(client: Instance) {
	return new Promise<void>((resolve) => {
		if (isDestroyed(client)) return resolve();
		client.destroy(() => resolve());
	});
}

export function applyTransferLimits() {
	const { downloadLimit, uploadLimit } = getRuntimeConfig().config.torrent;
	const client = getTorrentClient();
	client.throttleDownload(downloadLimit);
	client.throttleUpload(uploadLimit);
}

export async function restartTorrentClients() {
	const previousTorrentClient = getTorrentClient();
	const previousInfoClient = getInfoClient();

	// Publish replacements before destroying the old clients so other Next.js
	// server chunks can never resolve a destroyed singleton during the restart.
	global.torrentClientInstance = createTorrentClient();
	global.infoClientInstance = createInfoClient();

	await Promise.all([
		destroyClient(previousTorrentClient),
		destroyClient(previousInfoClient),
	]);
}
