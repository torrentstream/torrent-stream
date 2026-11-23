import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTmdbUrl, parseCatalogRequest } from "./tmdb";

const tmdbUrl = (query: string) => {
	const request = parseCatalogRequest(new URLSearchParams(query), 2026);
	return request
		? buildTmdbUrl(request, "KEY", "2026-01-01")
				.toString()
				.replace("https://api.themoviedb.org/3/", "")
		: null;
};
const common = "api_key=KEY&language=en&include_adult=false";

test("builds the upstream URL for each kind of request", () => {
	assert.equal(tmdbUrl(""), `trending/all/week?${common}&page=1`);
	assert.equal(
		tmdbUrl("type=movie&sort=rating&genre=28&year=2020&page=2"),
		`discover/movie?${common}&page=2&sort_by=vote_average.desc&with_genres=28&primary_release_year=2020&vote_count.gte=200&primary_release_date.lte=2026-01-01`,
	);
	assert.equal(
		tmdbUrl("type=tv&sort=oldest"),
		`discover/tv?${common}&page=1&sort_by=first_air_date.asc&first_air_date.lte=2026-01-01`,
	);
	assert.equal(
		tmdbUrl("type=tv&id=1399"),
		`tv/1399?${common}&page=1&append_to_response=external_ids`,
	);
	assert.equal(
		tmdbUrl("type=tv&id=1399&season=1&language=hu"),
		"tv/1399/season/1?api_key=KEY&language=hu&include_adult=false&page=1",
	);
	assert.equal(
		tmdbUrl("type=movie&genres=1"),
		`genre/movie/list?${common}&page=1`,
	);
	assert.equal(
		tmdbUrl("q=matrix"),
		`search/multi?${common}&page=1&query=matrix`,
	);
	assert.equal(
		tmdbUrl("q=matrix&type=movie"),
		`search/movie?${common}&page=1&query=matrix`,
	);
});

test("rejects invalid requests", () => {
	for (const query of [
		"type=book",
		"page=0",
		"page=501",
		"id=1399",
		"type=movie&id=0",
		"type=movie&id=1&season=1",
		"type=tv&season=1",
		"sort=popular",
		"genre=28",
		"genres=1",
		"type=movie&year=1899",
		"type=movie&year=2028",
		"type=movie&sort=best",
		`q=${"x".repeat(201)}`,
	])
		assert.equal(tmdbUrl(query), null, query);
});
