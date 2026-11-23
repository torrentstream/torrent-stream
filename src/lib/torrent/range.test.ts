import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRange } from "./range";

const whole = { start: 0, end: 999, partial: false };

describe("parseRange", () => {
	it("serves the whole file without a Range header", () => {
		assert.deepEqual(parseRange(null, 1000), whole);
		assert.deepEqual(parseRange(undefined, 1000), whole);
		assert.deepEqual(parseRange("", 1000), whole);
	});

	it("parses closed, open-ended and suffix ranges", () => {
		assert.deepEqual(parseRange("bytes=100-199", 1000), {
			start: 100,
			end: 199,
			partial: true,
		});
		assert.deepEqual(parseRange("bytes=100-", 1000), {
			start: 100,
			end: 999,
			partial: true,
		});
		assert.deepEqual(parseRange("bytes=-100", 1000), {
			start: 900,
			end: 999,
			partial: true,
		});
		assert.deepEqual(parseRange("bytes=5-5", 1000), {
			start: 5,
			end: 5,
			partial: true,
		});
	});

	it("treats an explicit full range as a range request", () => {
		assert.deepEqual(parseRange("bytes=0-", 1000), {
			start: 0,
			end: 999,
			partial: true,
		});
	});

	it("clamps the end and oversized suffixes to the file", () => {
		assert.deepEqual(parseRange("bytes=900-5000", 1000), {
			start: 900,
			end: 999,
			partial: true,
		});
		assert.deepEqual(parseRange("bytes=-5000", 1000), {
			start: 0,
			end: 999,
			partial: true,
		});
	});

	it("tolerates whitespace and unit case", () => {
		assert.deepEqual(parseRange(" Bytes= 10 - 20 ", 1000), {
			start: 10,
			end: 20,
			partial: true,
		});
	});

	it("serves only the first of multiple ranges", () => {
		assert.deepEqual(parseRange("bytes=0-9, 50-59", 1000), {
			start: 0,
			end: 9,
			partial: true,
		});
	});

	it("ignores syntactically invalid headers", () => {
		for (const header of [
			"bytes=500-100",
			"bytes=-",
			"bytes=abc-def",
			"bytes=1.5-2",
			"bytes=-1-5",
			"bytes 0-10",
			"items=0-10",
			"0-10",
			"bytes=99999999999999999999-",
		]) {
			assert.deepEqual(parseRange(header, 1000), whole, header);
		}
	});

	it("reports ranges outside the file as unsatisfiable", () => {
		assert.equal(parseRange("bytes=1000-", 1000), "unsatisfiable");
		assert.equal(parseRange("bytes=1000-2000", 1000), "unsatisfiable");
		assert.equal(parseRange("bytes=-0", 1000), "unsatisfiable");
		assert.equal(parseRange("bytes=0-", 0), "unsatisfiable");
		assert.equal(parseRange("bytes=-10", 0), "unsatisfiable");
	});

	it("serves an empty file without a Range header", () => {
		assert.deepEqual(parseRange(null, 0), {
			start: 0,
			end: -1,
			partial: false,
		});
	});
});
