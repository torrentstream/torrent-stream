"use client";
import { Menu } from "@base-ui/react/menu";
import { Check } from "lucide-react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { LanguageFlag } from "@/components/language-flag";
import { type Language, type TranslationValues, translate } from "@/lib/i18n";

const storageKey = "torrent-stream.language";
const LanguageContext = createContext({
	language: "en" as Language,
	setLanguage: (_language: Language) => {},
	t: (text: string, _values?: TranslationValues) => text,
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
	const [language, setLanguageState] = useState<Language>("en");
	useEffect(() => {
		const read = () => {
			try {
				const saved = localStorage.getItem(storageKey);
				setLanguageState(saved === "hu" ? "hu" : "en");
			} catch {
				/* Storage may be disabled. */
			}
		};
		read();
		const sync = (event: StorageEvent) => {
			if (event.key === storageKey || event.key === null) read();
		};
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, []);
	useEffect(() => {
		document.documentElement.lang = language;
	}, [language]);
	function setLanguage(next: Language) {
		setLanguageState(next);
		try {
			localStorage.setItem(storageKey, next);
		} catch {
			/* Keep the current session usable. */
		}
	}
	const t = useCallback(
		(text: string, values?: TranslationValues) =>
			translate(text, language, values),
		[language],
	);
	return (
		<LanguageContext.Provider
			value={{
				language,
				setLanguage,
				t,
			}}
		>
			{children}
		</LanguageContext.Provider>
	);
}
export function useLanguage() {
	return useContext(LanguageContext);
}
export function LanguageSelector({
	showLabel = false,
}: {
	showLabel?: boolean;
}) {
	const { language, setLanguage, t } = useLanguage();
	const languages = [
		{ code: "en", label: "English" },
		{ code: "hu", label: "Magyar" },
	] as const;
	return (
		<Menu.Root>
			<Menu.Trigger
				aria-label={t("Language")}
				title={t("Language")}
				className={`inline-flex shrink-0 cursor-pointer items-center rounded-md transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 ${showLabel ? "min-h-11 w-full justify-start gap-3 px-3" : "size-10 justify-center"}`}
			>
				<LanguageFlag code={language} />
				{showLabel && <span className="text-sm">{t("Language")}</span>}
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner align="end" sideOffset={8} className="z-[60]">
					<Menu.Popup
						aria-label={t("Language")}
						className="min-w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md outline-none"
					>
						<Menu.RadioGroup
							value={language}
							onValueChange={(value) =>
								setLanguage(value === "hu" ? "hu" : "en")
							}
						>
							{languages.map(({ code, label }) => (
								<Menu.RadioItem
									key={code}
									value={code}
									label={label}
									closeOnClick
									className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
								>
									<LanguageFlag code={code} className="size-5" />
									<span className="flex-1">{label}</span>
									<Menu.RadioItemIndicator>
										<Check aria-hidden="true" className="size-4" />
									</Menu.RadioItemIndicator>
								</Menu.RadioItem>
							))}
						</Menu.RadioGroup>
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	);
}
