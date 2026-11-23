import { Suspense } from "react";
import {
	MediaBrowser,
	MediaBrowserSkeleton,
} from "@/components/catalog/media-browser";

export default function BrowsePage() {
	return (
		<Suspense fallback={<MediaBrowserSkeleton />}>
			<MediaBrowser />
		</Suspense>
	);
}
