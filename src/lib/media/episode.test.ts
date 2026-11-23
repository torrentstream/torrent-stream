import assert from "node:assert/strict";
import { test } from "node:test";
import { type EpisodeGuess, getEpisodeNumber, isEpisodeFile } from "./episode";

const names: [name: string, expected: EpisodeGuess][] = [
	// Single episodes
	["Show.S01E02.1080p.WEB.h264-GRP", { season: 1, episode: 2, episodes: [2] }],
	["Show.S01.E02.720p", { season: 1, episode: 2, episodes: [2] }],
	["show s1e2 hdtv", { season: 1, episode: 2, episodes: [2] }],
	["Show_S03_E10_WEBRip", { season: 3, episode: 10, episodes: [10] }],
	["Show - S02EP07 - Title", { season: 2, episode: 7, episodes: [7] }],
	["Show.1x02.HDTV.XviD", { season: 1, episode: 2, episodes: [2] }],
	["Show 12x105", { season: 12, episode: 105, episodes: [105] }],
	["Show Season 1 Episode 2 1080p", { season: 1, episode: 2, episodes: [2] }],
	["Show.2019.S02E05.2160p", { season: 2, episode: 5, episodes: [5] }],
	["One.Piece.S01E1001.1080p", { season: 1, episode: 1001, episodes: [1001] }],
	["Show.S00E03.Special", { season: 0, episode: 3, episodes: [3] }],
	["Show.S01E05-720p", { season: 1, episode: 5, episodes: [5] }],
	["Show.S01E05-10bit", { season: 1, episode: 5, episodes: [5] }],

	["Show.S01E02v2.1080p", { season: 1, episode: 2, episodes: [2] }],

	// Tokens that only look like a second episode marker
	[
		"[Kametsu] Show - S01E03 (BD 1080p Hi10 FLAC) [E9A1B2C3]",
		{ season: 1, episode: 3, episodes: [3] },
	],
	[
		"Show.S01E12.1080p.WEB [E2A1B2C3]",
		{ season: 1, episode: 12, episodes: [12] },
	],
	["Show.S01E05.1080p.WEB.x264-E7", { season: 1, episode: 5, episodes: [5] }],
	[
		"One Piece S21E175 (E1071) 1080p",
		{ season: 21, episode: 175, episodes: [175] },
	],
	[
		"Show - Episode 3 [E9A1B2C3]",
		{ season: undefined, episode: 3, episodes: [3] },
	],
	["Show.S01E01.S01E03", { season: 1, episode: 1, episodes: [1, 3] }],

	// Multi-episode files
	["Show.S01E01-E03.1080p", { season: 1, episode: 1, episodes: [1, 2, 3] }],
	["Show.S01E01E02.1080p", { season: 1, episode: 1, episodes: [1, 2] }],
	["Show.S01E04-06.1080p", { season: 1, episode: 4, episodes: [4, 5, 6] }],
	["Show.S01E01.E02.E03", { season: 1, episode: 1, episodes: [1, 2, 3] }],

	// Episode without a season
	["E01", { season: undefined, episode: 1, episodes: [1] }],
	["Episode 12 - Title", { season: undefined, episode: 12, episodes: [12] }],
	["Show Ep 3", { season: undefined, episode: 3, episodes: [3] }],

	// Season packs
	["Show.S01.1080p.BluRay.x264-GRP", { seasons: [1] }],
	["Show Season 2 Complete 720p", { seasons: [2] }],
	["Show.S01.COMPLETE", { seasons: [1] }],
	["Show S2 - 03", { seasons: [2] }],
	["Show.S01-S03.1080p", { seasons: [1, 2, 3] }],
	["Show.S01.S02.S03.720p", { seasons: [1, 2, 3] }],
	["Show Seasons 1-4 BDRip", { seasons: [1, 2, 3, 4] }],
	["Show Season 1 to 3", { seasons: [1, 2, 3] }],
	["Show Season 2 - 1080p", { seasons: [2] }],
	["Show.S00.Specials", { seasons: [0] }],

	// Complete series
	["Show The Complete Series 1080p", { completeSeries: true }],
	["Show.COMPLETE.720p.BluRay", { completeSeries: true }],

	// No episode information, including the old false positives
	["Movie.2019.1080p.BluRay.Atmos7.1.x264", {}],
	["Se7en.1995.1080p.BluRay", {}],
	["Blade2.2002.720p", {}],
	["Movie.2019.DTS5.1.x264", {}],
	["Movie.2019.1080p.DD5.1x264-GRP", {}],
	["Movie.1920x1080.x265", {}],
	["Apollo13.1995.BDRip", {}],
	["Les.Miserables.2012", {}],
	["Terminator2.Remastered", {}],
];

for (const [name, expected] of names) {
	test(`getEpisodeNumber("${name}")`, () => {
		assert.deepEqual(getEpisodeNumber(name), expected);
	});
}

const files: [
	path: string,
	season: number,
	episode: number,
	expected: boolean,
	torrentName?: string,
][] = [
	// Season and episode in the file name
	["Show.S01E02.1080p.mkv", 1, 2, true],
	["Show.S01E02.1080p.mkv", 1, 3, false],
	["Show.S01E02.1080p.mkv", 2, 2, false],
	["Show.S01/Show.S01E02.mkv", 1, 2, true],
	["Show/Season 1/Show - 1x02 - Title.mkv", 1, 2, true],
	["Show S01-S03/Show.S02E05.mkv", 2, 5, true],
	// The file name wins over a misleading folder
	["Season 2/Show.S01E02.mkv", 1, 2, true],
	["Season 2/Show.S01E02.mkv", 2, 2, false],

	// Multi-episode files
	["Show.S01E01-E03.mkv", 1, 2, true],
	["Show.S01E01E02.mkv", 1, 2, true],
	["Show.S01E01-E03.mkv", 1, 4, false],

	// Season from the nearest parent folder
	["Show/Season 1/E01.mkv", 1, 1, true],
	["Show/Season 1/E01.mkv", 1, 2, false],
	["Show/Season 1/E01.mkv", 2, 1, false],
	["Show S01/Episode 1.mkv", 1, 1, true],
	["Show S01/Ep 4 - Title.mkv", 1, 4, true],
	["S01/01 - Pilot.mkv", 1, 1, true],
	["S01/02.mkv", 1, 2, true],
	["Show.S02.1080p.WEB-GRP/10. Finale.mp4", 2, 10, true],
	["Show Complete/Season 3/07 - Title.mkv", 3, 7, true],
	["Show S01-S03/Season 2/E05.mkv", 2, 5, true],
	["Show S01-S03/Season 2/E05.mkv", 1, 5, false],
	["Show\\Season 1\\E03.mkv", 1, 3, true],
	["Show Season 1/Show Season 1 Episode 6.mkv", 1, 6, true],

	// A leading number that may be the title of the show
	["24 Season 1/24 - 05.mkv", 1, 24, false],
	["24 Season 1/24 - 24.mkv", 1, 24, false],
	["9-1-1 S01/9-1-1 - 05.mkv", 1, 9, false],
	["24 Season 1/24 - S01E05.mkv", 1, 5, true],
	["S01/01 - 1080p.mkv", 1, 1, true],
	["S01/02 - The One with 2 Parts.mkv", 1, 2, true],
	// Extras are not episodes
	["Show.S01/Featurettes/01 - Making of.mkv", 1, 1, false],
	["Show.S01/Extras/02.mkv", 1, 2, false],
	["Show.S01/Extras/Show.S01E02.Commentary.mkv", 1, 2, true],
	// An unrelated token does not widen the episode
	["Show S01/[Kametsu] Show - S01E03 (BD 1080p) [E9A1B2C3].mkv", 1, 7, false],
	["Show S01/[Kametsu] Show - S01E03 (BD 1080p) [E9A1B2C3].mkv", 1, 3, true],

	// A multi-season folder does not pin the season down
	["Show S01-S03/E05.mkv", 1, 5, false],
	["Show S01-S03/05 - Title.mkv", 2, 5, false],

	// No season anywhere
	["Show/E01.mkv", 1, 1, false],
	["01 - Pilot.mkv", 1, 1, false],
	["Movie.2019.1080p.mkv", 1, 1, false],

	// Season known only from the search result name
	["Show (2019)/01 - Pilot.mkv", 1, 1, true, "Show S01 1080p WEB"],
	["Show (2019)/01 - Pilot.mkv", 2, 1, false, "Show S01 1080p WEB"],
	["Show (2019)/E02.mkv", 1, 2, false, "Show S01-S02 1080p"],
	// A folder that names the season wins over the search result name
	["Show/Season 2/E02.mkv", 2, 2, true, "Show S01-S03"],

	// Not episode numbers
	["Show S01/1080p.Sample.mkv", 1, 108, false],
	["Show S01/2001 A Space Odyssey.mkv", 1, 200, false],
	["Show S01/Atmos7.1.Demo.mkv", 7, 1, false],

	// Single-episode torrent with an uninformative file name
	["Show.S01E05.1080p-GRP/grp-video.mkv", 1, 5, true],
	["Show.S01E05.1080p-GRP/grp-video.mkv", 1, 6, false],
];

for (const [path, season, episode, expected, torrentName] of files) {
	const context = torrentName ? ` in "${torrentName}"` : "";
	test(`isEpisodeFile("${path}", ${season}, ${episode})${context} is ${expected}`, () => {
		assert.equal(isEpisodeFile(path, season, episode, torrentName), expected);
	});
}
