import type { RuntimeConfig } from "@/lib/config/schema";

export interface RemovalOptions {
	/** The user's choice when removing a torrent by hand. */
	deleteFiles?: boolean;
	/** Keep the seed record and files, so seeding can resume later. */
	preserveSeedState?: boolean;
	/** Overrides every other rule. */
	forceDestroyStore?: boolean;
}

/** Whether removing a torrent also deletes its downloaded data. */
export function shouldDestroyStore(
	storage: Pick<RuntimeConfig["storage"], "mode" | "keepFiles">,
	options: RemovalOptions = {},
) {
	if (options.forceDestroyStore !== undefined) return options.forceDestroyStore;
	// Memory mode has nothing on disk to keep.
	if (storage.mode !== "file") return true;
	if (options.preserveSeedState) return false;
	return options.deleteFiles ?? !storage.keepFiles;
}
