import { TorrentList } from "@/components/torrent-list";
import { config, TorrentStorageMode } from "@/lib/config";
import { getTorrents } from "./actions";

export default async function TorrentsPage() {
	const torrents = await getTorrents();
	const showProgress = config.torrentStorageMode === TorrentStorageMode.File;
	return <TorrentList torrents={torrents} showProgress={showProgress} />;
}
