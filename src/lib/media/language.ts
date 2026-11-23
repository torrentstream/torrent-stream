/**
 * `aliases` are words that name the language outright. `tags` are the short
 * codes release names use ("ITA", "DAN"); many are ordinary title words too,
 * so they only count in the release-tag part of a name.
 */
export const supportedLanguages = [
	{
		code: "en",
		name: "English",
		flag: "🇺🇸",
		aliases: ["english"],
		tags: ["eng"],
	},
	{
		code: "hu",
		name: "Hungarian",
		flag: "🇭🇺",
		aliases: ["hungarian"],
		tags: ["hun"],
	},
	{
		code: "de",
		name: "German",
		flag: "🇩🇪",
		aliases: ["german", "deutsch"],
		tags: ["ger"],
	},
	{
		code: "fr",
		name: "French",
		flag: "🇫🇷",
		aliases: ["french", "francais"],
		tags: ["fre"],
	},
	{
		code: "it",
		name: "Italian",
		flag: "🇮🇹",
		aliases: ["italian", "italiano"],
		tags: ["ita"],
	},
	{
		code: "es",
		name: "Spanish",
		flag: "🇪🇸",
		aliases: ["spanish", "espanol", "castellano"],
		tags: ["spa", "esp"],
	},
	{
		code: "pt",
		name: "Portuguese",
		flag: "🇵🇹",
		aliases: ["portuguese", "portugues"],
		tags: ["por"],
	},
	{
		code: "ru",
		name: "Russian",
		flag: "🇷🇺",
		aliases: ["russian", "russkiy"],
		tags: ["rus"],
	},
	{
		code: "pl",
		name: "Polish",
		flag: "🇵🇱",
		aliases: ["polish", "polski"],
		tags: ["pol"],
	},
	{
		code: "nl",
		name: "Dutch",
		flag: "🇳🇱",
		aliases: ["dutch", "nederlands"],
		tags: ["dut"],
	},
	{
		code: "sv",
		name: "Swedish",
		flag: "🇸🇪",
		aliases: ["swedish", "svenska"],
		tags: ["swe"],
	},
	{
		code: "no",
		name: "Norwegian",
		flag: "🇳🇴",
		aliases: ["norwegian", "norsk"],
		tags: ["nor"],
	},
	{
		code: "da",
		name: "Danish",
		flag: "🇩🇰",
		aliases: ["danish", "dansk"],
		tags: ["dan"],
	},
	{
		code: "fi",
		name: "Finnish",
		flag: "🇫🇮",
		aliases: ["finnish", "suomi"],
		tags: ["fin"],
	},
	{
		code: "cs",
		name: "Czech",
		flag: "🇨🇿",
		aliases: ["czech", "cesky"],
		tags: ["cze"],
	},
	{
		code: "sk",
		name: "Slovak",
		flag: "🇸🇰",
		aliases: ["slovak", "slovensky"],
		tags: ["slo"],
	},
	{
		code: "tr",
		name: "Turkish",
		flag: "🇹🇷",
		aliases: ["turkish", "turkce"],
		tags: ["tur"],
	},
	{
		code: "el",
		name: "Greek",
		flag: "🇬🇷",
		aliases: ["greek", "ellinika"],
		tags: ["gre"],
	},
	{
		code: "ar",
		name: "Arabic",
		flag: "🇸🇦",
		aliases: ["arabic", "arabi"],
		tags: ["ara"],
	},
	{
		code: "he",
		name: "Hebrew",
		flag: "🇮🇱",
		aliases: ["hebrew", "ivrit"],
		tags: ["heb"],
	},
	{
		code: "ja",
		name: "Japanese",
		flag: "🇯🇵",
		aliases: ["japanese", "nihongo"],
		tags: ["jpn"],
	},
	{
		code: "ko",
		name: "Korean",
		flag: "🇰🇷",
		aliases: ["korean", "hangul"],
		tags: ["kor"],
	},
	{
		code: "zh",
		name: "Chinese",
		flag: "🇨🇳",
		aliases: ["chinese", "mandarin", "cantonese"],
		tags: ["chi"],
	},
	{ code: "hi", name: "Hindi", flag: "🇮🇳", aliases: ["hindi"], tags: ["hin"] },
	{ code: "th", name: "Thai", flag: "🇹🇭", aliases: ["thai"], tags: ["tha"] },
	{
		code: "vi",
		name: "Vietnamese",
		flag: "🇻🇳",
		aliases: ["vietnamese"],
		tags: ["vie"],
	},
	{
		code: "id",
		name: "Indonesian",
		flag: "🇮🇩",
		aliases: ["indonesian", "bahasa"],
		tags: ["ind"],
	},
	{
		code: "ms",
		name: "Malay",
		flag: "🇲🇾",
		aliases: ["malay", "melayu"],
		tags: ["msa"],
	},
	{
		code: "uk",
		name: "Ukrainian",
		flag: "🇺🇦",
		aliases: ["ukrainian"],
		tags: ["ukr"],
	},
	{
		code: "bg",
		name: "Bulgarian",
		flag: "🇧🇬",
		aliases: ["bulgarian"],
		tags: ["bul"],
	},
	{
		code: "ro",
		name: "Romanian",
		flag: "🇷🇴",
		aliases: ["romanian", "romana"],
		tags: ["rom"],
	},
	{
		code: "hr",
		name: "Croatian",
		flag: "🇭🇷",
		aliases: ["croatian", "hrvatski"],
		tags: ["hrv"],
	},
	{
		code: "sr",
		name: "Serbian",
		flag: "🇷🇸",
		aliases: ["serbian", "srpski"],
		tags: ["srp"],
	},
	{
		code: "sl",
		name: "Slovenian",
		flag: "🇸🇮",
		aliases: ["slovenian", "slovenski"],
		tags: ["slv"],
	},
	{
		code: "et",
		name: "Estonian",
		flag: "🇪🇪",
		aliases: ["estonian", "eesti"],
		tags: ["est"],
	},
	{
		code: "lv",
		name: "Latvian",
		flag: "🇱🇻",
		aliases: ["latvian", "latviesu"],
		tags: ["lav"],
	},
	{
		code: "lt",
		name: "Lithuanian",
		flag: "🇱🇹",
		aliases: ["lithuanian", "lietuviu"],
		tags: ["lit"],
	},
] as const;

type SupportedLanguage = (typeof supportedLanguages)[number];

const [english, hungarian, ...otherLanguages] = supportedLanguages;

const knownWords = new Set<string>(
	supportedLanguages.flatMap(({ aliases, tags }) => [...aliases, ...tags]),
);

// The title ends and the release tags start at the first year, season /
// episode or resolution token.
const releaseMarker =
	/^(?:(?:19|20)\d{2}|s\d{1,2}(?:e\d+.*)?|\d{1,2}x\d{2,3}|\d{3,4}[pi])$/;

// Names without such a token still switch to release tags at the source or
// codec: "Movie.DVDRip.XviD.Ger".
const sourceMarker =
	/^(?:dvdrip|bdrip|brrip|bluray|webrip|webdl|hdrip|hdtv|xvid|divx|[xh]26[45]|hevc)$/;

// Words that may stand between a language name and the release marker:
// "Movie.German.DL.1080p".
const languageSuffixes = new Set(["dl", "ml", "dubbed", "dub", "subbed"]);

interface Word {
	text: string;
	/** Written in capitals ("ITA", "iTA") in a name that is not all capitals. */
	shouted: boolean;
}

function getWords(name: string): Word[] {
	const rawWords = name
		// "español" => "espanol"
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.split(/[^\p{L}\p{N}]+/u)
		.flatMap((word) => {
			// Joined language tags: "HUNxENG" => "HUN", "ENG"
			const parts = word.split(/x/i);
			return parts.every((part) => knownWords.has(part.toLowerCase()))
				? parts
				: [word];
		});
	// Capitals only mean something when the rest of the name is not shouted too.
	const mixedCase = rawWords.some((word) => /\p{Ll}.*\p{Ll}/u.test(word));
	return rawWords.map((word) => ({
		text: word.toLowerCase(),
		shouted: mixedCase && /\p{Lu}.*\p{Lu}/u.test(word),
	}));
}

function toResult({ flag, name, code }: SupportedLanguage) {
	return { flag, language: name, code };
}

export function getLanguage(name: string, category?: string) {
	const words = getWords(name);
	const texts = words.map((word) => word.text);
	const releaseIndex = texts.findIndex((text) => releaseMarker.test(text));
	const markerIndex =
		releaseIndex !== -1
			? releaseIndex
			: texts.findIndex((text) => sourceMarker.test(text));
	const hasMarker = markerIndex !== -1;

	// The title may contain language words ("Dan In Real Life 2007", "The
	// Italian Job 2003"), so they only count where they are clearly a tag:
	// - after the marker;
	// - written in capitals, unlike the title: "Movie.ITA.2019";
	// - a full language name that closes the title: "Movie.German.2019",
	//   "Movie.German.DL.1080p".
	// Without a marker full language names count anywhere.
	const tags = new Set(hasMarker ? texts.slice(markerIndex + 1) : []);
	const names = new Set(hasMarker ? [] : texts);
	for (const word of words) {
		if (word.shouted) tags.add(word.text);
	}
	let titleEnd = markerIndex - 1;
	while (titleEnd > 0 && languageSuffixes.has(texts[titleEnd])) titleEnd--;
	if (titleEnd > 0) names.add(texts[titleEnd]);

	const mentions = ({ aliases, tags: codes }: SupportedLanguage) =>
		aliases.some((alias) => tags.has(alias) || names.has(alias)) ||
		codes.some((code) => tags.has(code));

	// "hun" is no title word, so it counts wherever it stands.
	if (mentions(hungarian) || texts.includes("hun") || category?.includes("HU"))
		return toResult(hungarian);

	for (const language of otherLanguages) {
		if (mentions(language)) return toResult(language);
		// Cyrillic characters
		if (language.code === "ru" && /[Ѐ-ӿ]/.test(name)) return toResult(language);
	}

	return toResult(english);
}
