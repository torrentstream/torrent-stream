import { Suspense } from "react";
import { Loading } from "@/components/catalog/load-state";
import { MediaBrowser } from "@/components/catalog/media-browser";

export default function BrowsePage() {
	return (
		<Suspense fallback={<Loading />}>
			<MediaBrowser />
		</Suspense>
	);
}
