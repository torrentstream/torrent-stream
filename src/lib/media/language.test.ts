import assert from "node:assert/strict";
import { test } from "node:test";
import { getLanguage, supportedLanguages } from "./language";

const cases: [name: string, code: string, category?: string][] = [
	// Default
	["Movie.2019.1080p.BluRay.x264-GRP", "en"],
	["Some Movie", "en"],
	["Movie.2019.ENG.1080p", "en"],

	// Release tags after the title
	["Movie.2019.HUN.1080p.BluRay.x264-GRP", "hu"],
	["Movie.2019.1080p.BluRay.ITA.ENG.x264", "it"],
	["Show.S01E02.GERMAN.720p.WEB.h264", "de"],
	["Show.S01.DAN.1080p.WEB", "da"],
	["Movie 2010 720p BluRay Rom", "ro"],
	["Movie.1999.FRENCH.DVDRip.XviD", "fr"],
	["Movie (2015) [1080p] [Español]", "es"],
	["Movie.2018.PORTUGUÊS.1080p", "pt"],
	["Show.2x05.POL.HDTV", "pl"],
	["Movie.1080p.SPA", "es"],

	// Hungarian wins, wherever it stands
	["Movie.2019.GER.HUN.1080p", "hu"],
	["Movie.HUN.2019.1080p", "hu"],
	["Movie Hun", "hu"],
	["Movie.2019.1080p.BluRay.x264", "hu", "Movies/HD/HU"],
	["Movie.2019.GERMAN.1080p", "hu", "Movies/HD/HU"],
	["Movie.2019.GERMAN.1080p", "de", "Movies/HD/EN"],

	// Joined tags
	["Movie.2019.HUNxENG.1080p", "hu"],
	["Movie.2019.1080p.GERxENG", "de"],
	["Movie.2019.1080p.x264.ENGxITA", "it"],

	// Title words are not language tags
	["Dan.In.Real.Life.2007.1080p.BluRay.x264", "en"],
	["Rom.2019.720p.WEB", "en"],
	["Lit.S01E01.1080p.WEB", "en"],
	["Fin.De.Siecle.2001.DVDRip", "en"],
	["The.Italian.Job.2003.1080p.BluRay", "en"],
	["Russian.Doll.S01E01.1080p.WEB", "en"],
	["The.Danish.Girl.2015.720p.BluRay", "en"],
	["Chi-Raq.2015.1080p", "en"],
	["Por Una Cabeza", "en"],
	["Dan In Real Life", "en"],
	["Tha Movie Est Lit", "en"],
	// Only the first "x" used to be replaced, and anywhere in the name
	["Max.Payne.2008.1080p.BluRay.x264", "en"],
	["Ex.Machina.2014.2160p.x265", "en"],

	// Capitals mark a tag in front of the release marker too
	["Movie.ITA.2019.1080p", "it"],
	["Movie.iTA.ENG.2019.1080p", "it"],
	["Movie ITA ENG 1080p BluRay x264", "it"],
	["Movie.WEB-DL.RUS", "ru"],
	["Movie.Title.FRENCH.2019.1080p.BluRay", "fr"],
	["Show.GERMAN.S01E05.1080p.WEB", "de"],
	["Show.FRENCH.S01E05.1080p.WEB", "fr"],
	// ...unless the whole name is in capitals
	["DAN IN REAL LIFE 2007 1080P", "en"],
	["THE ITALIAN JOB 2003 720P", "en"],

	// A language name that closes the title
	["Movie.German.2019.1080p.BluRay.x264", "de"],
	["Movie.German.DL.1080p.BluRay.x264-GRP", "de"],
	["Show.French.S01E05.1080p.WEB", "fr"],
	["German.2019.1080p", "en"],

	// A source or codec starts the tags when there is no other marker
	["Movie.DVDRip.XviD.Ger", "de"],
	["Dan.In.Real.Life.DVDRip.XviD", "en"],

	// Without a release marker full language names still count
	["Movie German", "de"],
	["Some Show Deutsch", "de"],
	["Film Italiano", "it"],

	// Cyrillic
	["Фильм.2019.1080p", "ru"],
	["Фильм 2019 HUN", "hu"],
	["Фильм.2019.GER.1080p", "de"],
];

for (const [name, code, category] of cases) {
	const context = category ? ` in ${category}` : "";
	test(`getLanguage("${name}")${context} is ${code}`, () => {
		assert.equal(getLanguage(name, category).code, code);
	});
}

test("getLanguage returns the flag, name and code of the table entry", () => {
	assert.deepEqual(getLanguage("Movie.2019.HUN.1080p"), {
		flag: "🇭🇺",
		language: "Hungarian",
		code: "hu",
	});
	assert.deepEqual(getLanguage("Movie.2019.1080p"), {
		flag: "🇺🇸",
		language: "English",
		code: "en",
	});
});

test("no word belongs to two languages", () => {
	const words = supportedLanguages.flatMap(({ aliases, tags }) => [
		...aliases,
		...tags,
	]);
	assert.equal(new Set(words).size, words.length);
});
