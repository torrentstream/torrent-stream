import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import {
	createDefaultRuntimeConfig,
	parseRuntimeConfig,
	type RuntimeConfig,
} from "./config-schema";
import { parseEnum } from "./enum";
import { LogLevel } from "./logger-level";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

export const deploymentConfig = {
	port: Number(process.env.PORT) || 3000,
	dev: process.env.NODE_ENV !== "production",
	logLevel: parseEnum(LogLevel, process.env.LOG_LEVEL, LogLevel.Info),
	encryptionKey: process.env.ENCRYPTION_KEY || "torrent_stream_default_key",
	configPath: process.env.CONFIG_PATH || "/config",
};

export interface RuntimeConfigSnapshot {
	config: RuntimeConfig;
	revision: string;
	warning?: string;
}

declare global {
	var runtimeConfigSnapshot: RuntimeConfigSnapshot | undefined;
}

const configFile = join(deploymentConfig.configPath, "config.json");

function revision(config: RuntimeConfig) {
	return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}

function persist(config: RuntimeConfig) {
	mkdirSync(deploymentConfig.configPath, { recursive: true });
	const temporary = `${configFile}.${process.pid}.tmp`;
	writeFileSync(temporary, `${JSON.stringify(config, null, "\t")}\n`);
	renameSync(temporary, configFile);
}

function ensureStorageDirectory(config: RuntimeConfig) {
	if (config.storage.mode !== "file") return;
	if (!config.storage.path) throw new Error("Storage path cannot be empty");
	mkdirSync(config.storage.path, { recursive: true });
}

function load(): RuntimeConfigSnapshot {
	if (!existsSync(configFile)) {
		const config = createDefaultRuntimeConfig();
		persist(config);
		return { config, revision: revision(config) };
	}

	try {
		const stored = JSON.parse(readFileSync(configFile, "utf8"));
		const config = parseRuntimeConfig(stored);
		ensureStorageDirectory(config);
		return { config, revision: revision(config) };
	} catch (error) {
		const suffix = new Date().toISOString().replace(/:/g, "-");
		const backup = join(
			deploymentConfig.configPath,
			`config.invalid-${suffix}.json`,
		);
		renameSync(configFile, backup);
		const config = createDefaultRuntimeConfig();
		persist(config);
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			config,
			revision: revision(config),
			warning: `Invalid configuration was moved to ${backup}: ${message}`,
		};
	}
}

if (!global.runtimeConfigSnapshot) {
	global.runtimeConfigSnapshot = load();
}

export function getRuntimeConfig() {
	return global.runtimeConfigSnapshot as RuntimeConfigSnapshot;
}

export function saveRuntimeConfig(value: unknown, expectedRevision: string) {
	const current = getRuntimeConfig();
	if (current.revision !== expectedRevision) {
		throw new Error(
			"Configuration changed in another tab. Reload before saving again.",
		);
	}
	const config = parseRuntimeConfig(value);
	ensureStorageDirectory(config);
	persist(config);
	const snapshot = { config, revision: revision(config) };
	global.runtimeConfigSnapshot = snapshot;
	return snapshot;
}
