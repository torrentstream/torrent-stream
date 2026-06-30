import pino from "pino";
import { deploymentConfig } from "./config";

const { logLevel, dev } = deploymentConfig;

export const logger = pino({
	level: logLevel,
	...(dev
		? {
				transport: {
					target: "pino-pretty",
					options: {
						colorize: true,
						ignore: "pid,hostname",
					},
				},
			}
		: {
				formatters: { level: (label) => ({ level: label }) },
				timestamp: () => `,"ts":"${Date.now()}"`,
			}),
});
