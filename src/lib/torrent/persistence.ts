import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Torrent } from "webtorrent";
import { deploymentConfig } from "@/lib/config/runtime";
import { logger } from "@/lib/logging/logger";

export interface SeedState {
	uploadedBase: number;
	downloadedBase: number;
	uploadedOffset: number;
	downloadedOffset: number;
}

interface SeedRecord {
	uploaded: number;
	downloaded: number;
	files: string[];
	provider?: string;
}

declare global {
	var seedRecordsMap: Record<string, SeedRecord> | undefined;
	var torrentShutdownHandlersRegistered: boolean | undefined;
}

const stateFile = join(deploymentConfig.configPath, "torrents.json");

let seedRecordsDirty = false;
let lastSeedFlush = 0;

export function metainfoFile(infoHash: string) {
	return join(deploymentConfig.configPath, `${infoHash}.torrent`);
}

function loadSeedRecords(): Record<string, SeedRecord> {
	if (!existsSync(stateFile)) return {};
	try {
		const parsed = JSON.parse(readFileSync(stateFile, "utf8"));
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			throw new Error("Seed state is not an object");
		}
		return Object.fromEntries(
			Object.entries(parsed).map(([infoHash, value]) => {
				const record =
					value && typeof value === "object"
						? (value as Record<string, unknown>)
						: {};
				return [
					infoHash,
					{
						uploaded: typeof record.uploaded === "number" ? record.uploaded : 0,
						downloaded:
							typeof record.downloaded === "number" ? record.downloaded : 0,
						files: Array.isArray(record.files)
							? record.files.filter(
									(file): file is string => typeof file === "string",
								)
							: [],
						provider:
							typeof record.provider === "string" ? record.provider : undefined,
					},
				];
			}),
		);
	} catch (error) {
		logger.error(error);
		const backup = `${stateFile}.invalid-${Date.now()}`;
		logger.warn(`Seed state is corrupted, moving it to ${backup}`);
		try {
			renameSync(stateFile, backup);
		} catch (renameError) {
			logger.error(renameError);
		}
		return {};
	}
}

if (!global.seedRecordsMap) global.seedRecordsMap = loadSeedRecords();

export const seedRecords = global.seedRecordsMap;

export function flushSeedRecords(force = false) {
	if (!seedRecordsDirty) return;
	if (!force && Date.now() - lastSeedFlush < 15 * 1000) return;
	lastSeedFlush = Date.now();
	try {
		mkdirSync(deploymentConfig.configPath, { recursive: true });
		writeFileSync(`${stateFile}.tmp`, JSON.stringify(seedRecords, null, "\t"));
		renameSync(`${stateFile}.tmp`, stateFile);
		seedRecordsDirty = false;
	} catch (error) {
		logger.error(error);
	}
}

if (!global.torrentShutdownHandlersRegistered) {
	global.torrentShutdownHandlersRegistered = true;
	const shutdown = () => {
		flushSeedRecords(true);
		process.exit(0);
	};
	process.once("SIGTERM", shutdown);
	process.once("SIGINT", shutdown);
}

export function getSeedTotals(torrent: Torrent, seed: SeedState) {
	return {
		uploaded:
			seed.uploadedBase + Math.max(0, torrent.uploaded - seed.uploadedOffset),
		downloaded:
			seed.downloadedBase +
			Math.max(0, torrent.downloaded - seed.downloadedOffset),
	};
}

export function updateSeedRecord(
	torrent: Torrent,
	seed: SeedState | undefined,
) {
	if (!seed) return;
	const record = seedRecords[torrent.infoHash];
	if (!record) return;
	const { uploaded, downloaded } = getSeedTotals(torrent, seed);
	record.uploaded = uploaded;
	record.downloaded = downloaded;
	seedRecordsDirty = true;
}

export function initSeedState(
	torrent: Torrent,
	provider: string | undefined,
): SeedState {
	let record = seedRecords[torrent.infoHash];
	if (!record) {
		record = {
			uploaded: 0,
			downloaded: 0,
			files: [],
			provider,
		};
		seedRecords[torrent.infoHash] = record;
		seedRecordsDirty = true;
	} else if (provider && record.provider !== provider) {
		record.provider = provider;
		seedRecordsDirty = true;
	}
	try {
		mkdirSync(deploymentConfig.configPath, { recursive: true });
		if (!existsSync(metainfoFile(torrent.infoHash))) {
			writeFileSync(metainfoFile(torrent.infoHash), torrent.torrentFile);
		}
	} catch (error) {
		logger.error(error);
	}
	flushSeedRecords(true);
	return {
		uploadedBase: record.uploaded,
		downloadedBase: record.downloaded,
		uploadedOffset: torrent.uploaded,
		downloadedOffset: torrent.downloaded,
	};
}

export function recordStreamedFile(infoHash: string, filePath: string) {
	const record = seedRecords[infoHash];
	if (!record || record.files.includes(filePath)) return;
	record.files.push(filePath);
	seedRecordsDirty = true;
	flushSeedRecords(true);
}

export function dropSeedRecord(infoHash: string) {
	delete seedRecords[infoHash];
	seedRecordsDirty = true;
	try {
		if (existsSync(metainfoFile(infoHash))) unlinkSync(metainfoFile(infoHash));
	} catch (error) {
		logger.error(error);
	}
	flushSeedRecords(true);
}
