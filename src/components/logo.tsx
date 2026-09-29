"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Logo() {
	const pathname = usePathname();
	return (
		<Link
			href="/"
			onNavigate={(event) => {
				if (pathname !== "/") return;
				event.preventDefault();
				window.scrollTo({
					top: 0,
					behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
						.matches
						? "instant"
						: "smooth",
				});
			}}
			className="text-lg sm:text-xl font-extrabold transition-opacity hover:opacity-80"
		>
			torrent-stream.
		</Link>
	);
}
