export interface TorrentRequest {
	uri: string;
	provider?: string;
}

export function serializeTorrentRequest(request: TorrentRequest) {
	return JSON.stringify(request);
}

export function parseTorrentRequest(value: string): TorrentRequest {
	try {
		const parsed = JSON.parse(value) as Partial<TorrentRequest>;
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			typeof parsed.uri === "string"
		) {
			return {
				uri: parsed.uri,
				provider:
					typeof parsed.provider === "string" ? parsed.provider : undefined,
			};
		}
	} catch {
		// Stream URLs created before provider support contain the URI directly.
	}

	return { uri: value };
}

export function isTorrentSeedProviderAllowed(
	whitelist: string[],
	provider: string | undefined,
) {
	if (!whitelist.length) return true;
	if (!provider) return false;
	return whitelist.includes(provider);
}
