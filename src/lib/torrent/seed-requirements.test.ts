import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	decideSeedRemoval,
	isSameTorrentName,
	normalizeRequiredNames,
	normalizeTorrentName,
	seedRequirementConfirmationDelay,
	seedRequirementGracePeriod,
} from "./seed-requirements";

const hour = 60 * 60 * 1000;
const name =
	"The.Lord.of.the.Rings.The.Rings.of.Power.S03E01-E04.1080p.AMZN.WEB-DL.DD+5.1.Atmos.H.264.HuN-No1";
const now = 100 * hour;
const seeded = {
	name,
	addedAt: now - seedRequirementGracePeriod,
	streaming: false,
};

describe("normalizeTorrentName", () => {
	it("keeps only lowercase letters and digits", () => {
		assert.equal(normalizeTorrentName("Á.B-c_1 [2]"), "ábc12");
	});
});

describe("normalizeRequiredNames", () => {
	it("drops duplicates and names without letters or digits", () => {
		assert.deepEqual(normalizeRequiredNames(["A.B", "a b", "...", ""]), ["ab"]);
	});
});

describe("isSameTorrentName", () => {
	const full = normalizeTorrentName(name);

	it("matches equal names", () => {
		assert.ok(isSameTorrentName(full, full));
	});

	it("matches a title the tracker truncated", () => {
		assert.ok(isSameTorrentName(full.slice(0, 30), full));
		assert.ok(isSameTorrentName(full, full.slice(0, 30)));
	});

	it("does not match a prefix too short to be distinctive", () => {
		assert.ok(!isSameTorrentName("thelordof", full));
	});

	it("does not match different torrents", () => {
		assert.ok(!isSameTorrentName(full, normalizeTorrentName("Other.Movie")));
	});
});

describe("decideSeedRemoval", () => {
	it("keeps a torrent the tracker still lists", () => {
		const required = normalizeRequiredNames([name.slice(0, 40)]);
		assert.deepEqual(decideSeedRemoval(seeded, required, now), {
			remove: false,
			unrequiredSince: undefined,
		});
	});

	it("keeps a torrent within its grace period", () => {
		const recent = { ...seeded, addedAt: now - seedRequirementGracePeriod + 1 };
		assert.deepEqual(decideSeedRemoval(recent, [], now), {
			remove: false,
			unrequiredSince: undefined,
		});
	});

	it("keeps a torrent that is being streamed", () => {
		const streamed = { ...seeded, streaming: true };
		assert.deepEqual(decideSeedRemoval(streamed, [], now), {
			remove: false,
			unrequiredSince: undefined,
		});
	});

	it("only marks an unlisted torrent on the first check", () => {
		assert.deepEqual(decideSeedRemoval(seeded, [], now), {
			remove: false,
			unrequiredSince: now,
		});
	});

	it("waits for a confirming check after the confirmation delay", () => {
		const marked = { ...seeded, unrequiredSince: now };
		const early = now + seedRequirementConfirmationDelay - 1;
		assert.deepEqual(decideSeedRemoval(marked, [], early), {
			remove: false,
			unrequiredSince: now,
		});
		const confirmed = now + seedRequirementConfirmationDelay;
		assert.deepEqual(decideSeedRemoval(marked, [], confirmed), {
			remove: true,
			unrequiredSince: now,
		});
	});

	it("clears the mark when the torrent is listed again", () => {
		const marked = { ...seeded, unrequiredSince: now - hour };
		const required = normalizeRequiredNames([name]);
		assert.deepEqual(decideSeedRemoval(marked, required, now), {
			remove: false,
			unrequiredSince: undefined,
		});
	});

	it("clears the mark while the torrent is streamed", () => {
		const marked = { ...seeded, streaming: true, unrequiredSince: now - hour };
		assert.deepEqual(decideSeedRemoval(marked, [], now), {
			remove: false,
			unrequiredSince: undefined,
		});
	});
});
