export async function register() {
	const { resumeSeedingTorrents } = await import("@/lib/torrent/streams");
	resumeSeedingTorrents();
}
