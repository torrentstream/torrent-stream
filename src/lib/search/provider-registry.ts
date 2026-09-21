import type { TorrentSearchProvider } from "./provider";
import { InsaneProvider } from "./providers/insane";
import { NcoreProvider } from "./providers/ncore";
import { TorrentioProvider } from "./providers/torrentio";
import { TorznabProvider } from "./providers/torznab";

const torrentioProvider = new TorrentioProvider();
const torznabProvider = new TorznabProvider();
const ncoreProvider = new NcoreProvider();
const insaneProvider = new InsaneProvider();

export const providers: TorrentSearchProvider[] = [
	ncoreProvider,
	insaneProvider,
	torrentioProvider,
	torznabProvider,
];

export function getProvider(id: string | undefined) {
	return providers.find((provider) => provider.id === id);
}

export function getProviderName(id: string | undefined) {
	return getProvider(id)?.name ?? id ?? "Unknown";
}
