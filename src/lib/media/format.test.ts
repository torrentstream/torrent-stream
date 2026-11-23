import assert from "node:assert/strict";
import { test } from "node:test";
import { getFormats, TorrentFormat } from "./format";

test("an MPEG-TS file extension is not a telesync tag", () => {
	const { formats, score } = getFormats("Show.S01E01.1080p.HDTV.ts");
	assert.deepEqual(formats, [TorrentFormat["1080p"], TorrentFormat.HDTV]);
	assert.equal(score, 2200);

	assert.deepEqual(getFormats("Show.S01E01.ts").formats, [
		TorrentFormat.Unknown,
	]);
	assert.deepEqual(getFormats("00001.m2ts").formats, [TorrentFormat.Unknown]);
});

test("telesync tags are still detected", () => {
	for (const name of [
		"Movie.2023.TS.x264-GRP",
		"Movie 2023 HDTS",
		"Movie.2023.TS.mkv",
		"Movie.2023.TELESYNC.ts",
		"Movie.2023.x264.TS",
	]) {
		const { formats, score } = getFormats(name);
		assert.deepEqual(
			formats.filter((format) => format === TorrentFormat.Cam),
			[TorrentFormat.Cam],
			name,
		);
		assert.ok(score < 0, name);
	}
});

const regressions: [name: string, formats: TorrentFormat[], score: number][] = [
	[
		"Movie.2019.2160p.UHD.BluRay.REMUX.DV.HEVC-GRP",
		[
			TorrentFormat["4K"],
			TorrentFormat.DolbyVision,
			TorrentFormat.BluRay,
			TorrentFormat.Remux,
			TorrentFormat.HEVC,
		],
		3570,
	],
	[
		"Movie.2019.1080p.WEB-DL.x264.mkv",
		[TorrentFormat["1080p"], TorrentFormat.Web, TorrentFormat.AVC],
		2400,
	],
	[
		"Show.S01E01.720p.HDTV.x264.mp4",
		[TorrentFormat["720p"], TorrentFormat.HDTV, TorrentFormat.AVC],
		1200,
	],
	["Movie.2019.DVDRip.XviD", [TorrentFormat.DVD, TorrentFormat.Xvid], 300],
	["Movie.2019.HDCAM.x264", [TorrentFormat.Cam, TorrentFormat.AVC], -5000],
	["Movie.2019.x264", [TorrentFormat.AVC, TorrentFormat.Unknown], -Infinity],
];

for (const [name, formats, score] of regressions) {
	test(`getFormats("${name}")`, () => {
		const result = getFormats(name);
		assert.deepEqual(result.formats, formats);
		assert.equal(result.score, score);
	});
}
