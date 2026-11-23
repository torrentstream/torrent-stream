import type { ProviderId, RuntimeConfig } from "@/lib/config/schema";

export interface Snapshot {
	config: RuntimeConfig;
	revision: string;
	warning?: string;
	providerOptions: ProviderOption[];
}

export interface ProviderOption {
	id: ProviderId;
	name: string;
	trackers: { id: string; name: string }[];
}

export function moveItem<T>(items: T[], moved: T, target: T) {
	const from = items.indexOf(moved);
	const to = items.indexOf(target);
	if (from < 0 || to < 0 || from === to) return;
	const [item] = items.splice(from, 1);
	items.splice(to, 0, item);
}
