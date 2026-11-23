import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it, mock } from "node:test";
import { waitForReady, withTimeout } from "./ready";

class FakeTorrent extends EventEmitter {
	ready = false;
	constructor(readonly infoHash = "") {
		super();
	}
	becomeReady() {
		this.ready = true;
		this.emit("ready");
	}
}

const noDuplicate = () => undefined;

function listeners(torrent: FakeTorrent) {
	return torrent.listenerCount("ready") + torrent.listenerCount("close");
}

describe("waitForReady", () => {
	it("resolves with the torrent once it is ready", async () => {
		const torrent = new FakeTorrent();
		const wait = waitForReady(torrent, noDuplicate);
		torrent.becomeReady();
		assert.equal(await wait.ready, torrent);
		assert.equal(listeners(torrent), 0);
	});

	it("resolves at once for a torrent that is already ready", async () => {
		const torrent = new FakeTorrent();
		torrent.ready = true;
		assert.equal(await waitForReady(torrent, noDuplicate).ready, torrent);
		assert.equal(listeners(torrent), 0);
	});

	it("fails when the torrent closes without a duplicate", async () => {
		const torrent = new FakeTorrent("abc");
		const wait = waitForReady(torrent, noDuplicate);
		torrent.emit("close");
		assert.equal(await wait.ready, "failed");
		assert.equal(listeners(torrent), 0);
	});

	it("fails when a torrent without an info hash closes", async () => {
		const torrent = new FakeTorrent();
		const other = new FakeTorrent();
		const wait = waitForReady(torrent, () => other);
		torrent.emit("close");
		assert.equal(await wait.ready, "failed");
	});

	it("follows the duplicate that survived", async () => {
		const added = new FakeTorrent("abc");
		const duplicate = new FakeTorrent("abc");
		const wait = waitForReady(added, (infoHash) =>
			infoHash === "abc" ? duplicate : undefined,
		);
		added.emit("close");
		assert.equal(wait.current(), duplicate);
		assert.equal(listeners(added), 0);
		duplicate.becomeReady();
		assert.equal(await wait.ready, duplicate);
		assert.equal(listeners(duplicate), 0);
	});

	it("resolves at once with a duplicate that is already ready", async () => {
		const added = new FakeTorrent("abc");
		const duplicate = new FakeTorrent("abc");
		duplicate.ready = true;
		const wait = waitForReady(added, () => duplicate);
		added.emit("close");
		assert.equal(await wait.ready, duplicate);
	});

	it("fails when cancelled and ignores later events", async () => {
		const torrent = new FakeTorrent();
		const wait = waitForReady(torrent, noDuplicate);
		wait.cancel();
		assert.equal(listeners(torrent), 0);
		torrent.becomeReady();
		assert.equal(await wait.ready, "failed");
	});
});

describe("withTimeout", () => {
	it("resolves with the result when it arrives in time", async () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			let finish!: (value: string) => void;
			const result = withTimeout(
				new Promise<string>((resolve) => {
					finish = resolve;
				}),
				1000,
			);
			mock.timers.tick(999);
			finish("done");
			assert.equal(await result, "done");
		} finally {
			mock.timers.reset();
		}
	});

	it('resolves with "pending" when the result is late', async () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const result = withTimeout(new Promise<string>(() => {}), 1000);
			mock.timers.tick(1000);
			assert.equal(await result, "pending");
		} finally {
			mock.timers.reset();
		}
	});
});
