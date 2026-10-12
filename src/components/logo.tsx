"use client";

import Link from "next/link";

export function Logo() {
	return (
		<Link
			href="/"
			aria-label="torrent-stream. — Browse or scroll to top"
			onClick={(event) => {
				if (
					window.scrollY <= 0 ||
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey ||
					event.button !== 0
				)
					return;
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
