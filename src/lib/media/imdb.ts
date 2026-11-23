export function isImdbId(str: string) {
	return /^tt\d{7,}$/.test(str);
}
