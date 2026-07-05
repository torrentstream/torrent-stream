import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Torrent, TorrentFile } from "webtorrent";
import { deploymentConfig, getRuntimeConfig } from "@/lib/config";
import {
	isProviderEnabled,
	isProviderSeedingEnabled,
	type RuntimeConfig,
} from "@/lib/config-schema";
import { logger } from "@/lib/logger";
import { LRU } from "@/lib/lru";
import { getProvider, providers } from "@/lib/search/providers";
import type { TorrentSearchProvider } from "@/lib/search/types";
import {
	applyTransferLimits,
	getTorrentClient,
	restartTorrentClients,
} from "./clients";
import { TorrentStreamChunkStore } from "./store";

interface TorrentData {
	provider?: string;
	streams: Map<string, TorrentStream>;
	speeds: LRU<number, { date: Date; upload: number; download: number }>;
	removalTimeout?: NodeJS.Timeout;
	seed?: SeedState;
	streamedFiles: Set<string>;
}

interface SeedState {
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
	var torrentDataMap: Map<Torrent, TorrentData> | undefined;
	var seedRecordsMap: Record<string, SeedRecord> | undefined;
	var torrentStatsInterval: NodeJS.Timeout | undefined;
	var torrentShutdownHandlersRegistered: boolean | undefined;
	var seedRequirementInterval: NodeJS.Timeout | undefined;
}

const stateFile = join(deploymentConfig.configPath, "torrents.json");

let seedRecordsDirty = false;
let lastSeedFlush = 0;

function metainfoFile(infoHash: string) {
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

function flushSeedRecords(force = false) {
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

if (!global.torrentDataMap) global.torrentDataMap = new Map();
if (!global.seedRecordsMap) global.seedRecordsMap = loadSeedRecords();

const torrentData = global.torrentDataMap;
const seedRecords = global.seedRecordsMap;

if (!global.torrentStatsInterval) {
	global.torrentStatsInterval = setInterval(() => {
		getTorrentClient().torrents.forEach((torrent) => {
			const data = torrentData.get(torrent);
			if (!data) return;
			const now = new Date();
			data.speeds.put(now.getTime(), {
				date: now,
				download: torrent.downloadSpeed,
				upload: torrent.uploadSpeed,
			});
			updateSeedRecord(torrent, data);
		});
		flushSeedRecords();
	}, 1000);
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

function isSeedingEnabled(provider: string | undefined) {
	const config = getRuntimeConfig().config;
	const registeredProvider = getProvider(provider);
	return (
		config.storage.mode === "file" &&
		registeredProvider !== undefined &&
		isProviderSeedingEnabled(config, registeredProvider.id)
	);
}

export class TorrentStream {
	id: string;
	torrent: Torrent;
	files = new Map<string, TorrentFile>();
	timeout?: NodeJS.Timeout;

	constructor(id: string, torrent: Torrent) {
		this.id = id;
		this.torrent = torrent;
	}

	refreshTimeout() {
		clearTimeout(this.timeout);
		this.timeout = setTimeout(() => {
			unregisterStream(this.id, this.torrent);
		}, getRuntimeConfig().config.torrent.idleTimeout);
	}
}

function seedTotals(torrent: Torrent, seed: SeedState) {
	return {
		uploaded:
			seed.uploadedBase + Math.max(0, torrent.uploaded - seed.uploadedOffset),
		downloaded:
			seed.downloadedBase +
			Math.max(0, torrent.downloaded - seed.downloadedOffset),
	};
}

function updateSeedRecord(torrent: Torrent, data: TorrentData) {
	if (!data.seed) return;
	const record = seedRecords[torrent.infoHash];
	if (!record) return;
	const { uploaded, downloaded } = seedTotals(torrent, data.seed);
	record.uploaded = uploaded;
	record.downloaded = downloaded;
	seedRecordsDirty = true;
}

function initSeedState(
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

function dropSeedRecord(infoHash: string) {
	delete seedRecords[infoHash];
	seedRecordsDirty = true;
	try {
		if (existsSync(metainfoFile(infoHash))) unlinkSync(metainfoFile(infoHash));
	} catch (error) {
		logger.error(error);
	}
	flushSeedRecords(true);
}

function unregisterTorrent(torrent: Torrent, preserveSeedState: boolean) {
	const data = torrentData.get(torrent);
	if (data) {
		clearTimeout(data.removalTimeout);
		data.streams.forEach((stream) => {
			clearTimeout(stream.timeout);
		});
		torrentData.delete(torrent);
	}
	if (!preserveSeedState && seedRecords[torrent.infoHash]) {
		dropSeedRecord(torrent.infoHash);
	}
	logger.info(
		`${preserveSeedState ? "Torrent suspended" : "Torrent removed"}: ${torrent.name} (${torrent.infoHash})`,
	);
	runGarbageCollection("A torrent was removed");
}

async function destroyTorrentInternal(
	torrent: Torrent,
	options: {
		deleteFiles?: boolean;
		preserveSeedState?: boolean;
		forceDestroyStore?: boolean;
	} = {},
) {
	const data = torrentData.get(torrent);
	if (data?.seed) updateSeedRecord(torrent, data);
	flushSeedRecords(true);
	const storage = getRuntimeConfig().config.storage;
	const destroyStore =
		options.forceDestroyStore ??
		(storage.mode === "file"
			? options.preserveSeedState
				? false
				: (options.deleteFiles ?? !storage.keepFiles)
			: true);
	return new Promise<void>((resolve) => {
		if (torrent.destroyed) {
			unregisterTorrent(torrent, options.preserveSeedState ?? false);
			resolve();
			return;
		}
		torrent.destroy({ destroyStore }, (error) => {
			if (error) logger.error(error);
			unregisterTorrent(torrent, options.preserveSeedState ?? false);
			resolve();
		});
	});
}

export function destroyTorrent(torrent: Torrent, deleteFiles?: boolean) {
	return destroyTorrentInternal(torrent, { deleteFiles });
}

function scheduleRemoval(torrent: Torrent) {
	const data = torrentData.get(torrent);
	if (!data || data.seed) return;
	clearTimeout(data.removalTimeout);
	data.removalTimeout = setTimeout(() => {
		if (torrent.destroyed) {
			unregisterTorrent(torrent, Boolean(seedRecords[torrent.infoHash]));
			return;
		}
		if (data.streams.size > 0) return;
		const preserveSeedState = Boolean(seedRecords[torrent.infoHash]);
		logger.debug(
			`${preserveSeedState ? "Suspending" : "Removing"} idle torrent: ${torrent.name} (${torrent.infoHash})`,
		);
		void destroyTorrentInternal(torrent, { preserveSeedState });
	}, getRuntimeConfig().config.torrent.removeTimeout);
}

export function getSeedStats(torrent: Torrent) {
	const data = torrentData.get(torrent);
	if (!data?.seed) return undefined;
	const { uploaded, downloaded } = seedTotals(torrent, data.seed);
	return {
		seeding: data.streams.size === 0,
		uploaded,
		downloaded,
		ratio: downloaded > 0 ? uploaded / downloaded : 0,
	};
}

export function registerTorrent(torrent: Torrent, provider?: string) {
	if (torrentData.has(torrent)) return;
	const storageMode = getRuntimeConfig().config.storage.mode;
	if (storageMode === "memory")
		torrent.store = new TorrentStreamChunkStore(torrent);
	const seed = isSeedingEnabled(provider)
		? initSeedState(torrent, provider)
		: undefined;
	torrentData.set(torrent, {
		provider,
		streams: new Map(),
		speeds: new LRU(300),
		seed,
		streamedFiles: new Set(seedRecords[torrent.infoHash]?.files ?? []),
	});
	logger.info(`Torrent added: ${torrent.name} (${torrent.infoHash})`);
}

export function registerStream(
	id: string,
	torrent: Torrent,
	file: TorrentFile,
) {
	const data = torrentData.get(torrent);
	if (!data) throw new Error("Torrent not registered");
	let stream = data.streams.get(id);
	if (!stream) {
		clearTimeout(data.removalTimeout);
		data.removalTimeout = undefined;
		stream = new TorrentStream(id, torrent);
		data.streams.set(id, stream);
		logger.info(`Stream started: ${torrent.name} (${id})`);
		if (getRuntimeConfig().config.storage.mode === "memory") {
			(torrent.store as TorrentStreamChunkStore).refreshCapacity();
		}
	}
	stream.files.set(file.path, file);
	if (!data.streamedFiles.has(file.path)) {
		data.streamedFiles.add(file.path);
		const record = seedRecords[torrent.infoHash];
		if (record && !record.files.includes(file.path)) {
			record.files.push(file.path);
			seedRecordsDirty = true;
			flushSeedRecords(true);
		}
	}
	return stream;
}

export function unregisterStream(id: string, torrent: Torrent) {
	const data = torrentData.get(torrent);
	if (!data) return;
	const stream = data.streams.get(id);
	if (!stream) return;
	clearTimeout(stream.timeout);
	data.streams.delete(id);
	logger.info(`Stream ended: ${torrent.name} (${id})`);
	if (getRuntimeConfig().config.storage.mode === "memory") {
		(torrent.store as TorrentStreamChunkStore).refreshCapacity();
	}
	if (data.streams.size === 0) {
		schedulePause(torrent);
		if (!data.seed) scheduleRemoval(torrent);
	}
}

export function schedulePause(torrent: Torrent) {
	const storage = getRuntimeConfig().config.storage;
	if (storage.mode !== "file") return;
	torrent._selections.clear();
	if (storage.idleDownload) {
		const streamed = getStreamedFiles(torrent);
		for (const file of torrent.files) {
			if (streamed.has(file.path)) file.select();
		}
	}
	torrent._updateSelections();
}

export function getStreams(torrent: Torrent) {
	return torrentData.get(torrent)?.streams.values().toArray() ?? [];
}

export function getTorrentProvider(torrent: Torrent) {
	return torrentData.get(torrent)?.provider;
}

export function getStreamedFiles(torrent: Torrent) {
	return torrentData.get(torrent)?.streamedFiles ?? new Set<string>();
}

export function getHistoricalSpeeds(torrent: Torrent) {
	return (
		torrentData
			.get(torrent)
			?.speeds.map.entries()
			.map(([, { date, download, upload }]) => ({
				date,
				download,
				upload,
			}))
			.toArray() ?? []
	);
}

function runGarbageCollection(reason: string) {
	if (typeof global.gc !== "function") return;
	global.gc();
	logger.debug(`GC triggered: ${reason}`);
}

function normalizeTorrentName(name: string) {
	return name.trim().toLocaleLowerCase();
}

async function checkProviderSeedRequirements(provider: TorrentSearchProvider) {
	let requiredNames: Set<string>;
	try {
		requiredNames = new Set(
			(await provider.getSeedRequirements())
				.map(normalizeTorrentName)
				.filter((name) => name.length > 0),
		);
	} catch (error) {
		logger.error(error);
		return;
	}
	if (!shouldCheckSeedRequirements(provider)) return;

	const torrents = getTorrentClient().torrents.filter((torrent) => {
		const data = torrentData.get(torrent);
		return (
			data?.provider === provider.id &&
			Boolean(data.seed) &&
			data.streams.size === 0 &&
			!requiredNames.has(normalizeTorrentName(torrent.name))
		);
	});

	await Promise.all(
		torrents.map(async (torrent) => {
			logger.debug(
				`Tracker no longer requires seeding, removing torrent: ${torrent.name} (${torrent.infoHash})`,
			);
			await destroyTorrentInternal(torrent);
		}),
	);
}

function shouldCheckSeedRequirements(provider: TorrentSearchProvider) {
	const config = getRuntimeConfig().config;
	return (
		config.storage.mode === "file" &&
		isProviderEnabled(config, provider.id) &&
		isProviderSeedingEnabled(config, provider.id)
	);
}

async function checkSeedRequirements() {
	const enabledProviders = providers.filter(shouldCheckSeedRequirements);
	await Promise.all(
		enabledProviders.map((provider) => checkProviderSeedRequirements(provider)),
	);
}

function stopSeedRequirementInterval() {
	clearInterval(global.seedRequirementInterval);
	global.seedRequirementInterval = undefined;
}

function startSeedRequirementInterval() {
	stopSeedRequirementInterval();
	if (getRuntimeConfig().config.storage.mode !== "file") return;
	global.seedRequirementInterval = setInterval(
		() => {
			void checkSeedRequirements();
		},
		60 * 60 * 1000,
	);
}

export async function resumeSeedingTorrents() {
	stopSeedRequirementInterval();
	if (getRuntimeConfig().config.storage.mode !== "file") {
		return;
	}
	const torrentClient = getTorrentClient();
	const resumed: Promise<void>[] = [];
	for (const infoHash of Object.keys(seedRecords)) {
		const record = seedRecords[infoHash];
		if (!isSeedingEnabled(record.provider)) continue;
		if (await torrentClient.get(infoHash)) continue;
		let metainfo: Buffer;
		try {
			metainfo = readFileSync(metainfoFile(infoHash));
		} catch {
			logger.warn(`Missing metainfo, dropping seed record: ${infoHash}`);
			dropSeedRecord(infoHash);
			continue;
		}
		resumed.push(
			new Promise((resolve) => {
				let timeout: NodeJS.Timeout;
				const done = () => {
					clearTimeout(timeout);
					resolve();
				};
				timeout = setTimeout(
					done,
					getRuntimeConfig().config.torrent.addTimeout,
				);
				const torrent = torrentClient.add(
					metainfo,
					{
						path: getRuntimeConfig().config.storage.path,
						destroyStoreOnDestroy: true,
						deselect: true,
					},
					(torrent) => {
						registerTorrent(torrent, record.provider);
						schedulePause(torrent);
						logger.info(
							`Seeding resumed: ${torrent.name} (${torrent.infoHash})`,
						);
						done();
					},
				);
				torrent.once("error", () => {
					logger.warn(`Resume failed, preserving seed record: ${infoHash}`);
					done();
				});
			}),
		);
	}
	await Promise.all(resumed);
	await checkSeedRequirements();
	startSeedRequirementInterval();
	flushSeedRecords(true);
}

async function suspendAllTorrents(
	previousMode: RuntimeConfig["storage"]["mode"],
) {
	const torrentClient = getTorrentClient();
	const torrents = [...torrentClient.torrents];
	const interruptedStreams = torrents.reduce(
		(total, torrent) => total + (torrentData.get(torrent)?.streams.size ?? 0),
		0,
	);
	await Promise.all(
		torrents.map((torrent) =>
			destroyTorrentInternal(torrent, {
				preserveSeedState: true,
				forceDestroyStore: previousMode === "memory",
			}),
		),
	);
	return interruptedStreams;
}

export async function applyRuntimeTorrentConfig(previous: RuntimeConfig) {
	const current = getRuntimeConfig().config;
	if (
		previous.storage.mode !== current.storage.mode ||
		previous.storage.path !== current.storage.path
	) {
		const interruptedStreams = await suspendAllTorrents(previous.storage.mode);
		await restartTorrentClients();
		await resumeSeedingTorrents();
		return { interruptedStreams, clientRestarted: true };
	}

	applyTransferLimits();
	const operations: Promise<void>[] = [];
	const torrentClient = getTorrentClient();
	for (const torrent of [...torrentClient.torrents]) {
		const data = torrentData.get(torrent);
		if (!data) continue;
		for (const stream of data.streams.values()) stream.refreshTimeout();
		if (current.storage.mode === "memory") {
			(torrent.store as TorrentStreamChunkStore).refreshCapacity();
		} else {
			if (data.streams.size === 0) schedulePause(torrent);
			const enabled = isSeedingEnabled(data.provider);
			if (enabled && !data.seed) {
				data.seed = initSeedState(torrent, data.provider);
			} else if (!enabled && data.seed) {
				updateSeedRecord(torrent, data);
				data.seed = undefined;
				if (data.streams.size === 0) {
					operations.push(
						destroyTorrentInternal(torrent, { preserveSeedState: true }),
					);
					continue;
				}
			}
		}
		if (!data.seed && data.streams.size === 0) scheduleRemoval(torrent);
	}
	await Promise.all(operations);
	await resumeSeedingTorrents();
	flushSeedRecords(true);
	return { interruptedStreams: 0, clientRestarted: false };
}
