export const seedRequirementCheckInterval = 60 * 60 * 1000;
export const seedRequirementGracePeriod = 8 * 60 * 60 * 1000;
// Checks also run on every configuration change, so the confirming check must
// be a later scheduled one rather than simply the next one.
export const seedRequirementConfirmationDelay =
	seedRequirementCheckInterval / 2;

// Tracker pages truncate long titles, so a name that is a prefix of the other
// counts as the same torrent once it is long enough to be distinctive.
const minimumPrefixMatchLength = 12;

export function normalizeTorrentName(name: string) {
	return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** The tracker's list as distinct normalized names, without empty ones. */
export function normalizeRequiredNames(names: string[]) {
	return [
		...new Set(
			names.map(normalizeTorrentName).filter((name) => name.length > 0),
		),
	];
}

/** Compares two normalized names. */
export function isSameTorrentName(a: string, b: string) {
	if (a === b) return true;
	const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
	return (
		shorter.length >= minimumPrefixMatchLength && longer.startsWith(shorter)
	);
}

export interface SeededTorrent {
	name: string;
	/** When seeding started (the seed record's `addedAt`). */
	addedAt: number;
	/** Whether a stream is currently reading from it. */
	streaming: boolean;
	/** When a check first found it unrequired, if one has. */
	unrequiredSince?: number;
}

/**
 * Decides, for one seeded torrent and one successful read of the tracker's
 * list, whether it may be removed. A torrent is only removed when it has
 * seeded through the grace period, nobody is streaming it, and it has been
 * missing from the list for at least the confirmation delay, so a single
 * incomplete page cannot remove anything.
 */
export function decideSeedRemoval(
	torrent: SeededTorrent,
	requiredNames: string[],
	now: number,
): { remove: boolean; unrequiredSince: number | undefined } {
	const name = normalizeTorrentName(torrent.name);
	const unrequired =
		now - torrent.addedAt >= seedRequirementGracePeriod &&
		!torrent.streaming &&
		!requiredNames.some((required) => isSameTorrentName(required, name));
	if (!unrequired) return { remove: false, unrequiredSince: undefined };

	const unrequiredSince = torrent.unrequiredSince ?? now;
	return {
		remove: now - unrequiredSince >= seedRequirementConfirmationDelay,
		unrequiredSince,
	};
}
