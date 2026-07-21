import { getEpisodeNumber } from "@/lib/media/episode";
import { getReadableSize } from "@/lib/media/file";
import { getFormats } from "@/lib/media/format";
import { getLanguage } from "@/lib/media/language";

type TorrentSearchResultParams = Pick<
	TorrentSearchResult,
	| "name"
	| "fileName"
	| "fileIndex"
	| "imdb"
	| "season"
	| "episode"
	| "tracker"
	| "category"
	| "size"
	| "seeds"
	| "peers"
	| "torrent"
	| "magnet"
	| "provider"
>;

export class TorrentSearchResult {
	name: string;
	fileName?: string;
	fileIndex?: number;
	imdb?: string;
	season?: number;
	episode?: number;
	tracker: string;
	category?: string;
	size?: number;
	seeds?: number;
	peers?: number;
	torrent?: string;
	magnet?: string;
	provider: string;

	constructor(params: TorrentSearchResultParams) {
		this.name = params.name;
		this.fileName = params.fileName;
		this.fileIndex = params.fileIndex;
		this.imdb = params.imdb;
		this.season = params.season;
		this.episode = params.episode;
		this.tracker = params.tracker;
		this.category = params.category;
		this.size = params.size;
		this.seeds = params.seeds;
		this.peers = params.peers;
		this.torrent = params.torrent;
		this.magnet = params.magnet;
		this.provider = params.provider;
	}

	get language() {
		return getLanguage(this.name, this.category);
	}

	get formats() {
		return getFormats(this.name);
	}

	get readableSize() {
		if (this.size === undefined) return "Unknown size";
		return getReadableSize(this.size);
	}

	isCorrectEpisode(season: number, episode: number) {
		if (this.season === season && this.episode === episode) return true;
		const guess = getEpisodeNumber(this.name);
		if (guess.completeSeries) return true;
		if (guess.seasons?.includes(season)) return true;
		if (guess.season === season && guess.episode === episode) return true;
		if (season === 0) {
			if (this.name.toLowerCase().includes("special")) return true;
			if (guess.season === undefined && guess.seasons === undefined)
				return true;
		}
		return false;
	}
}
