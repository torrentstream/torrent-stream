export const supportedLanguages = [
	{ code: "en", name: "English", flag: "🇺🇸" },
	{ code: "hu", name: "Hungarian", flag: "🇭🇺" },
	{ code: "de", name: "German", flag: "🇩🇪" },
	{ code: "fr", name: "French", flag: "🇫🇷" },
	{ code: "it", name: "Italian", flag: "🇮🇹" },
	{ code: "es", name: "Spanish", flag: "🇪🇸" },
	{ code: "pt", name: "Portuguese", flag: "🇵🇹" },
	{ code: "ru", name: "Russian", flag: "🇷🇺" },
	{ code: "pl", name: "Polish", flag: "🇵🇱" },
	{ code: "nl", name: "Dutch", flag: "🇳🇱" },
	{ code: "sv", name: "Swedish", flag: "🇸🇪" },
	{ code: "no", name: "Norwegian", flag: "🇳🇴" },
	{ code: "da", name: "Danish", flag: "🇩🇰" },
	{ code: "fi", name: "Finnish", flag: "🇫🇮" },
	{ code: "cs", name: "Czech", flag: "🇨🇿" },
	{ code: "sk", name: "Slovak", flag: "🇸🇰" },
	{ code: "tr", name: "Turkish", flag: "🇹🇷" },
	{ code: "el", name: "Greek", flag: "🇬🇷" },
	{ code: "ar", name: "Arabic", flag: "🇸🇦" },
	{ code: "he", name: "Hebrew", flag: "🇮🇱" },
	{ code: "ja", name: "Japanese", flag: "🇯🇵" },
	{ code: "ko", name: "Korean", flag: "🇰🇷" },
	{ code: "zh", name: "Chinese", flag: "🇨🇳" },
	{ code: "hi", name: "Hindi", flag: "🇮🇳" },
	{ code: "th", name: "Thai", flag: "🇹🇭" },
	{ code: "vi", name: "Vietnamese", flag: "🇻🇳" },
	{ code: "id", name: "Indonesian", flag: "🇮🇩" },
	{ code: "ms", name: "Malay", flag: "🇲🇾" },
	{ code: "uk", name: "Ukrainian", flag: "🇺🇦" },
	{ code: "bg", name: "Bulgarian", flag: "🇧🇬" },
	{ code: "ro", name: "Romanian", flag: "🇷🇴" },
	{ code: "hr", name: "Croatian", flag: "🇭🇷" },
	{ code: "sr", name: "Serbian", flag: "🇷🇸" },
	{ code: "sl", name: "Slovenian", flag: "🇸🇮" },
	{ code: "et", name: "Estonian", flag: "🇪🇪" },
	{ code: "lv", name: "Latvian", flag: "🇱🇻" },
	{ code: "lt", name: "Lithuanian", flag: "🇱🇹" },
] as const;

export function getLanguage(name: string, category?: string) {
	const split = name
		.toLowerCase()
		.replace(/\W/g, " ")
		.replace("x", " ")
		.split(" ");

	if (
		split.includes("hun") ||
		split.includes("hungarian") ||
		category?.includes("HU")
	)
		return { flag: "🇭🇺", language: "Hungarian", code: "hu" };
	if (
		split.includes("ger") ||
		split.includes("german") ||
		split.includes("deutsch")
	)
		return { flag: "🇩🇪", language: "German", code: "de" };
	if (
		split.includes("fre") ||
		split.includes("french") ||
		split.includes("francais")
	)
		return { flag: "🇫🇷", language: "French", code: "fr" };
	if (
		split.includes("ita") ||
		split.includes("italian") ||
		split.includes("italiano")
	)
		return { flag: "🇮🇹", language: "Italian", code: "it" };
	if (
		split.includes("spa") ||
		split.includes("spanish") ||
		split.includes("esp") ||
		split.includes("espanol") ||
		split.includes("castellano")
	)
		return { flag: "🇪🇸", language: "Spanish", code: "es" };
	if (
		split.includes("por") ||
		split.includes("portuguese") ||
		split.includes("portugues")
	)
		return { flag: "🇵🇹", language: "Portuguese", code: "pt" };
	if (
		split.includes("rus") ||
		split.includes("russian") ||
		split.includes("russkiy") ||
		/[\u0400-\u04FF]/.test(name) // Cyrillic characters
	)
		return { flag: "🇷🇺", language: "Russian", code: "ru" };
	if (
		split.includes("pol") ||
		split.includes("polish") ||
		split.includes("polski")
	)
		return { flag: "🇵🇱", language: "Polish", code: "pl" };
	if (
		split.includes("dut") ||
		split.includes("dutch") ||
		split.includes("nederlands")
	)
		return { flag: "🇳🇱", language: "Dutch", code: "nl" };
	if (
		split.includes("swe") ||
		split.includes("swedish") ||
		split.includes("svenska")
	)
		return { flag: "🇸🇪", language: "Swedish", code: "sv" };
	if (
		split.includes("nor") ||
		split.includes("norwegian") ||
		split.includes("norsk")
	)
		return { flag: "🇳🇴", language: "Norwegian", code: "no" };
	if (
		split.includes("dan") ||
		split.includes("danish") ||
		split.includes("dansk")
	)
		return { flag: "🇩🇰", language: "Danish", code: "da" };
	if (
		split.includes("fin") ||
		split.includes("finnish") ||
		split.includes("suomi")
	)
		return { flag: "🇫🇮", language: "Finnish", code: "fi" };
	if (
		split.includes("cze") ||
		split.includes("czech") ||
		split.includes("cesky")
	)
		return { flag: "🇨🇿", language: "Czech", code: "cs" };
	if (
		split.includes("slo") ||
		split.includes("slovak") ||
		split.includes("slovensky")
	)
		return { flag: "🇸🇰", language: "Slovak", code: "sk" };
	if (
		split.includes("tur") ||
		split.includes("turkish") ||
		split.includes("turkce")
	)
		return { flag: "🇹🇷", language: "Turkish", code: "tr" };
	if (
		split.includes("gre") ||
		split.includes("greek") ||
		split.includes("ellinika")
	)
		return { flag: "🇬🇷", language: "Greek", code: "el" };
	if (
		split.includes("ara") ||
		split.includes("arabic") ||
		split.includes("arabi")
	)
		return { flag: "🇸🇦", language: "Arabic", code: "ar" };
	if (
		split.includes("heb") ||
		split.includes("hebrew") ||
		split.includes("ivrit")
	)
		return { flag: "🇮🇱", language: "Hebrew", code: "he" };
	if (
		split.includes("jpn") ||
		split.includes("japanese") ||
		split.includes("nihongo")
	)
		return { flag: "🇯🇵", language: "Japanese", code: "ja" };
	if (
		split.includes("kor") ||
		split.includes("korean") ||
		split.includes("hangul")
	)
		return { flag: "🇰🇷", language: "Korean", code: "ko" };
	if (
		split.includes("chi") ||
		split.includes("chinese") ||
		split.includes("mandarin") ||
		split.includes("cantonese")
	)
		return { flag: "🇨🇳", language: "Chinese", code: "zh" };
	if (split.includes("hin") || split.includes("hindi"))
		return { flag: "🇮🇳", language: "Hindi", code: "hi" };
	if (split.includes("tha") || split.includes("thai"))
		return { flag: "🇹🇭", language: "Thai", code: "th" };
	if (split.includes("vie") || split.includes("vietnamese"))
		return { flag: "🇻🇳", language: "Vietnamese", code: "vi" };
	if (
		split.includes("ind") ||
		split.includes("indonesian") ||
		split.includes("bahasa")
	)
		return { flag: "🇮🇩", language: "Indonesian", code: "id" };
	if (
		split.includes("msa") ||
		split.includes("malay") ||
		split.includes("melayu")
	)
		return { flag: "🇲🇾", language: "Malay", code: "ms" };
	if (split.includes("ukr") || split.includes("ukrainian"))
		return { flag: "🇺🇦", language: "Ukrainian", code: "uk" };
	if (split.includes("bul") || split.includes("bulgarian"))
		return { flag: "🇧🇬", language: "Bulgarian", code: "bg" };
	if (
		split.includes("rom") ||
		split.includes("romanian") ||
		split.includes("romana")
	)
		return { flag: "🇷🇴", language: "Romanian", code: "ro" };
	if (
		split.includes("hrv") ||
		split.includes("croatian") ||
		split.includes("hrvatski")
	)
		return { flag: "🇭🇷", language: "Croatian", code: "hr" };
	if (
		split.includes("srp") ||
		split.includes("serbian") ||
		split.includes("srpski")
	)
		return { flag: "🇷🇸", language: "Serbian", code: "sr" };
	if (
		split.includes("slv") ||
		split.includes("slovenian") ||
		split.includes("slovenski")
	)
		return { flag: "🇸🇮", language: "Slovenian", code: "sl" };
	if (
		split.includes("est") ||
		split.includes("estonian") ||
		split.includes("eesti")
	)
		return { flag: "🇪🇪", language: "Estonian", code: "et" };
	if (
		split.includes("lav") ||
		split.includes("latvian") ||
		split.includes("latviesu")
	)
		return { flag: "🇱🇻", language: "Latvian", code: "lv" };
	if (
		split.includes("lit") ||
		split.includes("lithuanian") ||
		split.includes("lietuviu")
	)
		return { flag: "🇱🇹", language: "Lithuanian", code: "lt" };

	return { flag: "🇺🇸", language: "English", code: "en" };
}
