import type { TorrentSearchProvider } from "@/lib/search/types";
import { InsaneProvider } from "./insane";
import { NcoreProvider } from "./ncore";
import { TorrentioProvider } from "./torrentio";

const torrentioProvider = new TorrentioProvider();
const ncoreProvider = new NcoreProvider();
const insaneProvider = new InsaneProvider();

export const providers: TorrentSearchProvider[] = [
	ncoreProvider,
	insaneProvider,
	torrentioProvider,
];

export function getProvider(id: string | undefined) {
	return providers.find((provider) => provider.id === id);
}

export function getProviderName(id: string | undefined) {
	return getProvider(id)?.name ?? id ?? "Unknown";
}
