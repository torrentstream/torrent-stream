export interface EpisodeGuess {
	/** The name says "complete" without naming a season. */
	completeSeries?: true;
	/** Season pack: every season the name covers, and no episode. */
	seasons?: number[];
	season?: number;
	/** First episode of `episodes`. */
	episode?: number;
	/** Every episode the name covers, e.g. S01E01-E03 => [1, 2, 3]. */
	episodes?: number[];
}

// A marker only counts at the start of a token, so the "s7" of "Atmos7.1"
// and the "e7" of "Se7en" are not read as season / episode numbers.
const tokenStart = "(?<![a-z0-9])";
const separators = "[ ._-]";

// "E02", "Ep 2", "Episode 2", optionally continued as a range or a list:
// "E01-E03", "E01E02", "E01-03". The number may carry a version ("E02v2") or
// a part letter ("E02a"), but must end there, so that the checksum of
// "[E9A1B2C3]" is no episode.
const episodePattern =
	`(?:episodes?${separators}{0,2}|ep${separators}{0,2}|e)(?<episode>\\d{1,4})` +
	`(?<more>(?:(?:${separators}{0,2}e\\d{1,4}|-\\d{1,3})(?![0-9a-z]))*)` +
	`(?:v\\d|[a-d])?(?![0-9a-z])`;

// An episode marker, with its season when written as S01E02 / S01.E02.
const episodeRegex = new RegExp(
	`${tokenStart}(?:s(?<season>\\d{1,4})${separators}{0,3})?${episodePattern}`,
	"g",
);

// A season on its own: "S01".
const seasonRegex = new RegExp(`${tokenStart}s(\\d{1,2})(?![0-9a-z])`, "g");

// "Season 1", "Seasons 1-3", "Season 1 to 3".
const seasonWordRegex = new RegExp(
	`${tokenStart}seasons?${separators}{0,3}(\\d{1,2})` +
		`(?:[ ._]{0,2}(?:-|to|and|&)[ ._]{0,2}(\\d{1,2}))?(?![0-9a-z])`,
	"g",
);

// "1x02". The codecs in "5.1x264" / "5.1x265" are not episodes.
const crossRegex = new RegExp(
	`${tokenStart}(?<season>\\d{1,2})x(?!26[45](?![0-9]))(?<episode>\\d{1,3})(?![0-9a-z])`,
);

const completeRegex = /(?<![a-z])complete(?![a-z])/;

function range(first: number, last: number) {
	const numbers: number[] = [];
	for (let i = first; i <= last; i++) numbers.push(i);
	return numbers;
}

function spanOf(numbers: number[]) {
	return range(Math.min(...numbers), Math.max(...numbers));
}

export function getEpisodeNumber(name: string): EpisodeGuess {
	const str = name.toLowerCase();

	const seasons = new Set<number>();
	// A range only spans the numbers of one marker ("E01-E03"). Markers that
	// carry their season ("S01E03") are kept apart, because next to one of
	// them a bare "E7" is a group name or an absolute number, not an episode.
	const seasonedEpisodes = new Set<number>();
	const bareEpisodes = new Set<number>();

	for (const match of str.matchAll(episodeRegex)) {
		const numbers = [Number(match.groups?.episode)];
		for (const more of match.groups?.more.matchAll(/\d+/g) ?? []) {
			numbers.push(Number(more[0]));
		}
		if (match.groups?.season) seasons.add(Number(match.groups.season));
		const target = match.groups?.season ? seasonedEpisodes : bareEpisodes;
		for (const number of spanOf(numbers)) target.add(number);
	}
	const episodes = [
		...(seasonedEpisodes.size > 0 ? seasonedEpisodes : bareEpisodes),
	].sort((a, b) => a - b);
	for (const match of str.matchAll(seasonRegex)) {
		seasons.add(Number(match[1]));
	}
	for (const match of str.matchAll(seasonWordRegex)) {
		seasons.add(Number(match[1]));
		if (match[2]) seasons.add(Number(match[2]));
	}

	if (seasons.size === 0 && completeRegex.test(str)) {
		return { completeSeries: true };
	}
	if (seasons.size > 1) {
		return { seasons: spanOf([...seasons]) };
	}

	const [season] = seasons;

	if (episodes.length > 0) {
		return { season, episode: episodes[0], episodes };
	}
	if (season !== undefined) {
		return { seasons: [season] };
	}

	const cross = str.match(crossRegex);
	if (cross?.groups) {
		const episode = Number(cross.groups.episode);
		return {
			season: Number(cross.groups.season),
			episode,
			episodes: [episode],
		};
	}

	return {};
}

/** The season a name pins down, when it names exactly one. */
function getSingleSeason(guess: EpisodeGuess) {
	if (guess.season !== undefined) return guess.season;
	return guess.seasons?.length === 1 ? guess.seasons[0] : undefined;
}

const extrasFolderRegex =
	/^(?:extras?|featurettes?|bonus(?:es)?|samples?|trailers?|interviews?|deleted scenes|behind the scenes)$/i;

/**
 * "01 - Pilot", "01", "1. Pilot": an episode number leading the file name.
 * Not when a second number follows right away ("24 - 05", "9-1-1 - 05"),
 * where the first one may just as well be the title of the show.
 */
function getLeadingNumber(fileName: string) {
	const match = fileName.match(
		/^\s*(\d{1,3})(?![0-9a-z])(?![\s._-]+\d+(?![0-9a-z]))/i,
	);
	return match ? Number(match[1]) : undefined;
}

/**
 * Whether the file at `path` (folders included) is the requested episode.
 *
 * The season is taken from the file name, else from the nearest parent folder
 * that names one, else from `torrentName`. Only when the season comes from
 * such a context is a bare "E01" / "Episode 1" / leading "01" accepted as the
 * episode.
 */
export function isEpisodeFile(
	path: string,
	season: number,
	episode: number,
	torrentName?: string,
) {
	const folders = path.split(/[\\/]/);
	const fileName = (folders.pop() ?? "").replace(/\.[a-z][a-z0-9]{1,3}$/i, "");
	const file = getEpisodeNumber(fileName);

	const isExtra = folders.some((folder) => extrasFolderRegex.test(folder));
	const contexts = folders.reverse();
	if (torrentName) contexts.push(torrentName);

	let context: EpisodeGuess = {};
	for (const name of contexts) {
		const guess = getEpisodeNumber(name);
		if (guess.season === undefined && guess.seasons === undefined) continue;
		context = guess;
		break;
	}

	const fileSeason = getSingleSeason(file);
	const actualSeason = fileSeason ?? getSingleSeason(context);
	if (actualSeason !== season) return false;

	const leading =
		fileSeason === undefined && !isExtra
			? getLeadingNumber(fileName)
			: undefined;
	const episodes =
		file.episodes ??
		(leading !== undefined ? [leading] : undefined) ??
		// A single-episode torrent whose file name says nothing useful.
		context.episodes;

	return episodes?.includes(episode) ?? false;
}
