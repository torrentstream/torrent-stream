export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;
	const { resumeSeedingTorrents } = await import("@/lib/torrent/streams");
	resumeSeedingTorrents();
}
