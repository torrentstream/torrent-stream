const translatedFields = ["title", "name", "overview", "tagline"];
const collections = ["results", "episodes", "seasons", "genres"];

type Metadata = Record<string, unknown>;

function isMetadata(value: unknown): value is Metadata {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function usesOriginalTitle(data: Metadata, field: string, language: string) {
	const original =
		field === "title"
			? data.original_title
			: field === "name"
				? data.original_name
				: undefined;
	return Boolean(
		original &&
			data[field] === original &&
			data.original_language &&
			data.original_language !== language,
	);
}

export function needsEnglishFallback(data: Metadata, language = "en"): boolean {
	return (
		translatedFields.some(
			(field) =>
				field in data &&
				(!data[field] || usesOriginalTitle(data, field, language)),
		) ||
		collections.some((field) => {
			const items = data[field];
			return (
				Array.isArray(items) &&
				items.some(
					(item) => isMetadata(item) && needsEnglishFallback(item, language),
				)
			);
		})
	);
}

export function applyEnglishFallback(
	data: Metadata,
	english: Metadata,
	language = "en",
) {
	for (const field of translatedFields) {
		if (
			field in data &&
			(!data[field] || usesOriginalTitle(data, field, language)) &&
			english[field]
		)
			data[field] = english[field];
	}
	for (const field of collections) {
		const items = data[field];
		const fallbackItems = english[field];
		if (!Array.isArray(items) || !Array.isArray(fallbackItems)) continue;
		const byId = new Map(
			fallbackItems.filter(isMetadata).map((item) => [item.id, item]),
		);
		for (const item of items) {
			if (!isMetadata(item)) continue;
			const fallback = byId.get(item.id);
			if (fallback) applyEnglishFallback(item, fallback, language);
		}
	}
}
