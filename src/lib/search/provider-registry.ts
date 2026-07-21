import type { TorrentSearchProvider } from "./provider";
import { InsaneProvider } from "./providers/insane";
import { NcoreProvider } from "./providers/ncore";
import { TorrentioProvider } from "./providers/torrentio";

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
