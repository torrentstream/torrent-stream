import assert from "node:assert/strict";
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import { contentLengthHeader, forwardContentLength } from "./content-length";

// The compression middleware Next.js applies to responses.
const compression: () => (
	req: IncomingMessage,
	res: ServerResponse,
	next: () => void,
) => void = require("next/dist/compiled/compression");

async function serve(
	handle: (res: ServerResponse) => void,
	method = "GET",
	headers: Record<string, string> = {},
) {
	const server = createServer((req, res) => {
		forwardContentLength(res);
		compression()(req, res, () => handle(res));
	});
	await new Promise<void>((resolve) => server.listen(0, resolve));
	try {
		const { port } = server.address() as AddressInfo;
		const response = await fetch(`http://localhost:${port}`, {
			method,
			headers,
		});
		return { headers: response.headers, body: await response.text() };
	} finally {
		server.close();
	}
}

describe("forwardContentLength", () => {
	it("sends the private header as Content-Length", async () => {
		const { headers, body } = await serve((res) => {
			res.setHeader(contentLengthHeader, "5");
			res.write("he");
			res.end("llo");
		});
		assert.equal(headers.get("content-length"), "5");
		assert.equal(headers.get(contentLengthHeader), null);
		assert.equal(headers.get("transfer-encoding"), null);
		assert.equal(body, "hello");
	});

	it("works for HEAD responses without a body", async () => {
		const { headers } = await serve((res) => {
			res.setHeader(contentLengthHeader, "1234");
			res.end();
		}, "HEAD");
		assert.equal(headers.get("content-length"), "1234");
	});

	it("leaves responses without the header alone", async () => {
		const { headers, body } = await serve((res) => {
			res.write("he");
			res.end("llo");
		});
		assert.equal(headers.get("content-length"), null);
		assert.equal(headers.get("transfer-encoding"), "chunked");
		assert.equal(body, "hello");
	});

	it("keeps headers passed to writeHead", async () => {
		const { headers } = await serve((res) => {
			res.setHeader(contentLengthHeader, "2");
			res.writeHead(206, { "content-range": "bytes 0-1/10" });
			res.end("ab");
		});
		assert.equal(headers.get("content-length"), "2");
		assert.equal(headers.get("content-range"), "bytes 0-1/10");
	});

	const text = "WEBVTT\n\n".padEnd(4000, "x");
	const vtt = (res: ServerResponse, cacheControl?: string) => {
		res.setHeader("content-type", "text/vtt");
		if (cacheControl) res.setHeader("cache-control", cacheControl);
		res.setHeader(contentLengthHeader, String(text.length));
		res.end(text);
	};

	it("never sends a Content-Length for a compressed body", async () => {
		const { headers, body } = await serve((res) => vtt(res), "GET", {
			"accept-encoding": "gzip",
		});
		assert.equal(headers.get("content-encoding"), "gzip");
		assert.equal(headers.get("content-length"), null);
		assert.equal(body, text);
	});

	it("is not compressed when marked no-transform", async () => {
		const { headers, body } = await serve(
			(res) => vtt(res, "no-transform"),
			"GET",
			{ "accept-encoding": "gzip" },
		);
		assert.equal(headers.get("content-encoding"), null);
		assert.equal(headers.get("content-length"), String(text.length));
		assert.equal(body, text);
	});
});
