import english from "./messages/en.json";
import hungarian from "./messages/hu.json";

export type Language = "en" | "hu";
export type MessageKey = keyof typeof english;
export type TranslationValues = Record<string, string | number>;

// Enforce matching message keys in both locales.
const messages: Record<Language, Record<MessageKey, string>> = {
	en: english,
	hu: hungarian,
};

export function translate(
	text: string,
	language: Language,
	values: TranslationValues = {},
) {
	const dictionary: Record<string, string> = messages[language];
	const message = Object.hasOwn(dictionary, text) ? dictionary[text] : text;
	return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
		String(values[key] ?? placeholder),
	);
}

export function formatDate(
	date: string | null,
	language: Language,
): string | null {
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
	const parsed = new Date(`${date}T00:00:00Z`);
	if (
		Number.isNaN(parsed.getTime()) ||
		parsed.toISOString().slice(0, 10) !== date
	)
		return null;
	return new Intl.DateTimeFormat(language, {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(parsed);
}

export function languageLabel(
	code: string,
	language: Language,
	fallback: string,
) {
	const name =
		new Intl.DisplayNames([language], { type: "language" }).of(code) ||
		fallback;
	return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
}
