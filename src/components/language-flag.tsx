import {
	BG,
	CN,
	CZ,
	DE,
	DK,
	EE,
	ES,
	FI,
	FR,
	GR,
	HR,
	HU,
	ID,
	IL,
	IN,
	IT,
	JP,
	KR,
	LT,
	LV,
	MY,
	NL,
	NO,
	PL,
	PT,
	RO,
	RS,
	RU,
	SA,
	SE,
	SI,
	SK,
	TH,
	TR,
	UA,
	US,
	VN,
} from "country-flag-icons/react/3x2";
import { cn } from "@/lib/utils";

const flags = {
	en: US,
	hu: HU,
	de: DE,
	fr: FR,
	it: IT,
	es: ES,
	pt: PT,
	ru: RU,
	pl: PL,
	nl: NL,
	sv: SE,
	no: NO,
	da: DK,
	fi: FI,
	cs: CZ,
	sk: SK,
	tr: TR,
	el: GR,
	ar: SA,
	he: IL,
	ja: JP,
	ko: KR,
	zh: CN,
	hi: IN,
	th: TH,
	vi: VN,
	id: ID,
	ms: MY,
	uk: UA,
	bg: BG,
	ro: RO,
	hr: HR,
	sr: RS,
	sl: SI,
	et: EE,
	lv: LV,
	lt: LT,
} as const;

export function LanguageFlag({
	code,
	className,
}: {
	code: string;
	className?: string;
}) {
	const Flag = flags[code as keyof typeof flags] || US;
	return (
		<Flag
			aria-hidden="true"
			focusable="false"
			className={cn("size-4 shrink-0", className)}
		/>
	);
}
