import assert from "node:assert/strict";
import { test } from "node:test";
import { subtitleTrackFormat } from "./movi-patches";

test("uses the format reported by the server", () => {
	assert.equal(subtitleTrackFormat({ format: "srt", lang: "hu" }), "srt");
	assert.equal(subtitleTrackFormat({ format: "vtt", lang: "x.srt" }), "vtt");
});

test("derives the format from a torrent subtitle file name", () => {
	assert.equal(subtitleTrackFormat({ lang: "Subs/Movie.en.SRT" }), "srt");
	assert.equal(subtitleTrackFormat({ lang: "Movie.vtt" }), "vtt");
});

test("rejects formats the player cannot parse", () => {
	for (const lang of ["a.ass", "a.ssa", "a.sub", "a.smi", "a.srt.bak", "en"])
		assert.equal(subtitleTrackFormat({ lang }), null);
});
