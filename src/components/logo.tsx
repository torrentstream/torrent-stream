"use client";

export function Logo() {
	return (
		<button
			type="button"
			aria-label="torrent-stream. — Scroll to top"
			onClick={() => {
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
		</button>
	);
}
