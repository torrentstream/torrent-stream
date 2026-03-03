import mime from "mime";

export function isVideoFile(name: string) {
	return mime.getType(name)?.startsWith("video") || false;
}

export function isSubtitleFile(name: string) {
	return [".srt", ".sub", ".vtt", ".smi", ".ssa", ".ass"].some((ext) =>
		name.toLowerCase().endsWith(ext),
	);
}

export function getStreamingMimeType(name: string) {
	const mimeType = mime.getType(name);
	return mimeType?.startsWith("video")
		? "video/mp4"
		: mimeType || "application/unknown";
}

const unitMap = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4, PB: 5 };

export function getReadableSize(
	size: number,
	minUnit: keyof typeof unitMap = "KB",
) {
	if (size === 0) return "0 B";
	var e = Math.floor(Math.log(size) / Math.log(1024));
	if (minUnit !== undefined) {
		e = Math.max(e, unitMap[minUnit]);
	}
	return `${formatMax2Decimals(size / 1024 ** e)} ${" KMGTP".charAt(e)}B`.replace(
		"  ",
		" ",
	);
}

export function getReadableProgress(progress: number) {
	return `${formatMax2Decimals(progress * 100)}%`;
}

function formatMax2Decimals(value: number) {
	return value.toFixed(2).replace(/\.?0+$/, "");
}
