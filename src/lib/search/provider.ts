import type { ProviderId } from "@/lib/config/schema";
import type { TorrentSearchResult } from "./result";

export enum TorrentCategory {
	Movie = "movie",
	Series = "series",
}

export abstract class TorrentSearchProvider {
	abstract id: ProviderId;
	abstract name: string;
	trackers: { id: string; name: string }[] = [];

	abstract searchTorrentsByCategory(
		query: string,
		category: TorrentCategory,
		season?: number,
		episode?: number,
	): Promise<TorrentSearchResult[]>;

	abstract getSeedRequirements(): Promise<string[]>;
}
