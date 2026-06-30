import Link from "next/link";

export function Logo() {
	return (
		<Link
			href="/"
			className="mx-2 text-xl font-extrabold transition-opacity hover:opacity-80"
		>
			torrent-stream.
		</Link>
	);
}
