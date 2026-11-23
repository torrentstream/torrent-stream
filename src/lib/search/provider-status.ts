import type { ProviderId } from "@/lib/config/schema";

export interface ProviderSearchStatus {
	at: number;
	ok: boolean;
	/** Number of results returned by a successful search. */
	results?: number;
	/** Error message of a failed search or login. */
	message?: string;
}

export type SeedCheckOutcome =
	/** The tracker's list was read and applied. */
	| "checked"
	/** The tracker could not be read. */
	| "failed";

export interface ProviderSeedCheckStatus {
	at: number;
	outcome: SeedCheckOutcome;
	/** Torrents the tracker still requires seeding for. */
	required?: number;
	/** Torrents removed because the tracker no longer requires them. */
	removed?: number;
	/** Error message of a failed check. */
	message?: string;
}

export interface ProviderStatus {
	search?: ProviderSearchStatus;
	seedCheck?: ProviderSeedCheckStatus;
}

declare global {
	var providerStatusMap: Map<ProviderId, ProviderStatus> | undefined;
}

if (!global.providerStatusMap) global.providerStatusMap = new Map();

const statuses = global.providerStatusMap;

function update(id: ProviderId, patch: ProviderStatus) {
	statuses.set(id, { ...statuses.get(id), ...patch });
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function recordSearchSuccess(id: ProviderId, results: number) {
	update(id, { search: { at: Date.now(), ok: true, results } });
}

export function recordSearchFailure(id: ProviderId, error: unknown) {
	update(id, {
		search: { at: Date.now(), ok: false, message: errorMessage(error) },
	});
}

export function recordSeedCheck(
	id: ProviderId,
	status: Omit<ProviderSeedCheckStatus, "at">,
) {
	update(id, { seedCheck: { at: Date.now(), ...status } });
}

export function recordSeedCheckFailure(id: ProviderId, error: unknown) {
	recordSeedCheck(id, { outcome: "failed", message: errorMessage(error) });
}

/** Statuses describe the saved configuration, so a new one starts clean. */
export function clearProviderStatuses() {
	statuses.clear();
}

export function getProviderStatuses(): Partial<
	Record<ProviderId, ProviderStatus>
> {
	return Object.fromEntries(statuses);
}
