import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		id: "/",
		name: "torrent-stream.",
		short_name: "torrent-stream",
		description: "Browse movies and series and stream your torrents.",
		start_url: "/",
		scope: "/",
		display: "standalone",
		background_color: "#171717",
		theme_color: "#171717",
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
			{
				src: "/icons/icon-maskable-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
}
