import type { Instance } from "webtorrent";
import WebTorrent from "webtorrent";
import { config } from "@/lib/config";
import { logger } from "@/lib/logger";

declare global {
	var torrentClientInstance: Instance | undefined;
	var infoClientInstance: Instance | undefined;
}

if (!global.torrentClientInstance) {
	global.torrentClientInstance = new WebTorrent({
		downloadLimit: config.torrentDownloadLimit,
		uploadLimit: config.torrentUploadLimit,
	});
	global.torrentClientInstance.on("error", (error) => {
		if (
			error instanceof Error &&
			error.message.startsWith("Cannot add duplicate torrent")
		) {
			return;
		}

		logger.error(error);
	});
}

if (!global.infoClientInstance) {
	global.infoClientInstance = new WebTorrent();
	global.infoClientInstance.on("error", () => {});
}

export const torrentClient = global.torrentClientInstance;
export const infoClient = global.infoClientInstance;
