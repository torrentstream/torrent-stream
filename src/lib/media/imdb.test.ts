import assert from "node:assert/strict";
import { test } from "node:test";
import { isImdbId } from "./imdb";

test("isImdbId accepts title ids", () => {
	for (const id of ["tt0111161", "tt1234567", "tt10872600"]) {
		assert.equal(isImdbId(id), true, id);
	}
});

test("isImdbId rejects everything else", () => {
	for (const id of [
		"",
		"tt123456",
		"tt1234567/../x",
		"../tt1234567",
		"tt1234567:1:2",
		"tt1234567.json",
		" tt1234567",
		"tt1234567\n",
		"TT1234567",
		"nm0000151",
		"The Matrix",
		"movie tt1234567",
	]) {
		assert.equal(isImdbId(id), false, JSON.stringify(id));
	}
});
