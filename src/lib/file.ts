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

export function roundSpeed(bytesPerSecond: number) {
	const resolution = 10 * 1024;
	return Math.round(bytesPerSecond / resolution) * resolution;
}

export function getReadableSpeed(bytesPerSecond: number) {
	const roundedSpeed = roundSpeed(bytesPerSecond);
	if (roundedSpeed < 1024 ** 2) {
		return `${roundedSpeed / 1024} KB/s`;
	}
	return `${getReadableSize(roundedSpeed)}/s`;
}

export function getReadableDuration(seconds: number) {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

function formatMax2Decimals(value: number) {
	return value.toFixed(2).replace(/\.?0+$/, "");
}
