import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldDestroyStore } from "./removal";

const file = { mode: "file", keepFiles: false } as const;
const keeping = { mode: "file", keepFiles: true } as const;
const memory = { mode: "memory", keepFiles: false } as const;

describe("shouldDestroyStore", () => {
	it("always clears memory storage", () => {
		assert.equal(shouldDestroyStore(memory), true);
		assert.equal(shouldDestroyStore(memory, { deleteFiles: false }), true);
		assert.equal(shouldDestroyStore(memory, { preserveSeedState: true }), true);
	});

	it("follows the keep files setting by default", () => {
		assert.equal(shouldDestroyStore(file), true);
		assert.equal(shouldDestroyStore(keeping), false);
	});

	it("follows the user's choice when removing by hand", () => {
		assert.equal(shouldDestroyStore(keeping, { deleteFiles: true }), true);
		assert.equal(shouldDestroyStore(file, { deleteFiles: false }), false);
	});

	it("keeps the files of a torrent that will resume seeding", () => {
		assert.equal(shouldDestroyStore(file, { preserveSeedState: true }), false);
		assert.equal(
			shouldDestroyStore(file, { preserveSeedState: true, deleteFiles: true }),
			false,
		);
	});

	it("lets forceDestroyStore override everything", () => {
		assert.equal(
			shouldDestroyStore(memory, { forceDestroyStore: false }),
			false,
		);
		assert.equal(
			shouldDestroyStore(keeping, {
				preserveSeedState: true,
				forceDestroyStore: true,
			}),
			true,
		);
	});
});
