import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSeedRequirements } from "./shared";

const selectors = {
	entries: "a.torrentname",
	pageMarker: 'a[href*="hnr.php"]',
};

test("parseSeedRequirements reads the listed torrent names", () => {
	const html = `
		<a href="hnr.php?type=all">All</a>
		<a class="torrentname" title="Show.S01E01.1080p">Show.S01E01...</a>
		<a class="torrentname">Movie.2019.720p</a>`;
	assert.deepEqual(parseSeedRequirements("Tracker", html, selectors), [
		"Show.S01E01.1080p",
		"Movie.2019.720p",
	]);
});

test("parseSeedRequirements accepts a recognised page without entries", () => {
	const html = `<a href="hnr.php?type=all">All</a><p>Nothing to seed.</p>`;
	assert.deepEqual(parseSeedRequirements("Tracker", html, selectors), []);
});

test("parseSeedRequirements rejects a page that is not the list", () => {
	for (const html of [
		"",
		"<h1>Maintenance</h1>",
		"<p>Checking your browser</p>",
	]) {
		assert.throws(
			() => parseSeedRequirements("Tracker", html, selectors),
			/Tracker H&R page was not recognised/,
		);
	}
});
