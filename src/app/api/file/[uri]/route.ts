import { type NextRequest, NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { decryptText } from "@/lib/encryption";
import { getStreamingMimeType } from "@/lib/media/file";
import {
	getOrAddTorrent,
	getReadableStream,
	metadataDeadline,
} from "@/lib/torrent/playback";
import { parseRange } from "@/lib/torrent/range";
import { parseTorrentRequest } from "@/lib/torrent/request";

export async function GET(
	request: NextRequest,
	context: RouteContext<"/api/file/[uri]">,
) {
	const { uri } = await context.params;

	const streamId = request.nextUrl.searchParams.get("s");
	if (!streamId) {
		return NextResponse.json({ error: "Missing stream ID." }, { status: 400 });
	}

	const fileParam = request.nextUrl.searchParams.get("f");
	if (!fileParam || !/^\d+$/.test(fileParam)) {
		return NextResponse.json({ error: "Missing file index." }, { status: 400 });
	}
	const fileIndex = Number(fileParam);

	let torrentRequest: ReturnType<typeof parseTorrentRequest>;
	try {
		torrentRequest = parseTorrentRequest(decryptText(uri));
	} catch {
		return NextResponse.json({ error: "Invalid stream URL." }, { status: 400 });
	}

	const torrent = await getOrAddTorrent(
		torrentRequest.uri,
		torrentRequest.provider,
		request.nextUrl.searchParams.get("prepare") === "1"
			? metadataDeadline
			: undefined,
	);
	if (torrent === "failed") {
		// Nothing is loading any more, so the client should not keep retrying.
		return NextResponse.json(
			{ error: "Torrent could not be loaded." },
			{ status: 502 },
		);
	}
	if (torrent === "pending") {
		// The torrent keeps looking for its metadata, so a retry may succeed.
		return NextResponse.json(
			{ error: "Torrent is not ready yet." },
			{ status: 503, headers: { "Retry-After": "5" } },
		);
	}

	const file = torrent.files[fileIndex];
	if (!file) {
		return NextResponse.json(
			{ error: "File not found in torrent." },
			{ status: 404 },
		);
	}

	// The player probes the full file size before issuing ranged reads.
	// A HEAD response must not inherit the in-memory range cap or start downloading.
	if (request.method === "HEAD") {
		return new NextResponse(null, {
			headers: {
				"Accept-Ranges": "bytes",
				"Content-Length": String(file.length),
				"Content-Type": getStreamingMimeType(file.name),
				"Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
			},
		});
	}

	const range = parseRange(request.headers.get("range"), file.length);
	if (range === "unsatisfiable") {
		return new NextResponse(null, {
			status: 416,
			headers: { "Content-Range": `bytes */${file.length}` },
		});
	}

	const { start } = range;
	let { end, partial } = range;

	if (getRuntimeConfig().config.storage.mode === "memory") {
		const startByte = file.offset + start;
		const startPiece = Math.floor(startByte / torrent.pieceLength);
		const nextPieceStartByte = (startPiece + 1) * torrent.pieceLength;
		const bytesUntilNextPiece = nextPieceStartByte - startByte;
		const buffer = Math.max(
			1,
			Math.floor(
				getRuntimeConfig().config.storage.streamMemoryLimit /
					torrent.pieceLength /
					2,
			),
		);
		const maxLength = bytesUntilNextPiece + (buffer - 1) * torrent.pieceLength;

		if (end - start >= maxLength) {
			end = Math.min(start + maxLength - 1, file.length - 1);
			// Not the whole file any more, even if no range was requested.
			partial = true;
		}
	}

	if (request.signal.aborted) {
		return new NextResponse(null, { status: 499 });
	}

	const headers = new Headers({
		Connection: "keep-alive",
		"Keep-Alive": `timeout=60, max=10000`,
		"Accept-Ranges": "bytes",
		"Content-Length": `${end - start + 1}`,
		"Content-Type": getStreamingMimeType(file.name),
		"Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
	});
	if (partial) {
		headers.set("Content-Range", `bytes ${start}-${end}/${file.length}`);
	}
	const status = partial ? 206 : 200;

	// An empty file has nothing to stream.
	if (file.length === 0) return new NextResponse(null, { status, headers });

	const stream = getReadableStream(
		streamId,
		torrent,
		file,
		start,
		end,
		request.signal,
	);

	return new NextResponse(stream, { status, headers });
}

export const HEAD = GET;
