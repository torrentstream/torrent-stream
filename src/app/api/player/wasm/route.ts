import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET() {
	const wasm = await readFile(
		join(process.cwd(), "node_modules/movi-player/dist/movi.wasm"),
	);
	return new Response(new Uint8Array(wasm), {
		headers: {
			"Content-Type": "application/wasm",
			"Cache-Control": "public, max-age=86400",
		},
	});
}
