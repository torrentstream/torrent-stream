import { LanguageFlag } from "@/components/language-flag";
import { useLanguage } from "@/components/language-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RuntimeConfig } from "@/lib/config/schema";
import { languageLabel } from "@/lib/i18n";
import { supportedLanguages } from "@/lib/media/language";
import { Chip, PasswordField, Section } from "./fields";

export function SubtitlesCard({
	config,
	update,
}: {
	config: RuntimeConfig;
	update: (recipe: (next: RuntimeConfig) => void) => void;
}) {
	const { t } = useLanguage();
	return (
		<Section title={t("Subtitles")}>
			<div className="space-y-2">
				<PasswordField
					id="opensubtitles-api-key"
					label={t("OpenSubtitles API key")}
					autoComplete="off"
					value={config.opensubtitles.apiKey}
					onChange={(value) =>
						update((next) => {
							next.opensubtitles.apiKey = value;
						})
					}
				/>
				<p className="text-xs leading-relaxed text-muted-foreground">
					{t(
						"Used for subtitle search. Leave empty to use the default key. Get an API key from your",
					)}{" "}
					<a
						className="underline underline-offset-4"
						href="https://www.opensubtitles.com/consumers"
						target="_blank"
						rel="noreferrer"
					>
						{t("OpenSubtitles account")}
					</a>
					.
				</p>
			</div>
			<div className="space-y-2">
				<div className="grid gap-6 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="opensubtitles-username">
							{t("Username (optional)")}
						</Label>
						<Input
							id="opensubtitles-username"
							autoComplete="username"
							value={config.opensubtitles.username}
							onChange={(event) =>
								update((next) => {
									next.opensubtitles.username = event.target.value;
								})
							}
						/>
					</div>
					<PasswordField
						id="opensubtitles-password"
						label={t("Password (optional)")}
						value={config.opensubtitles.password}
						onChange={(value) =>
							update((next) => {
								next.opensubtitles.password = value;
							})
						}
					/>
				</div>
				<p className="text-xs leading-relaxed text-muted-foreground">
					{t(
						"Sign in to use your account’s download allowance. Without a login, OpenSubtitles applies its anonymous download limit.",
					)}
				</p>
			</div>
			<LanguageSelection
				selected={config.opensubtitles.languages}
				multiple
				onSelect={(language) =>
					update((next) => {
						next.opensubtitles.languages =
							next.opensubtitles.languages.includes(language)
								? next.opensubtitles.languages.filter(
										(code) => code !== language,
									)
								: [...next.opensubtitles.languages, language];
					})
				}
			/>
			<p className="text-xs leading-relaxed text-muted-foreground">
				{t(
					"Choose subtitle languages. With none selected, subtitle search is disabled.",
				)}
			</p>
		</Section>
	);
}

function LanguageSelection({
	selected,
	multiple = false,
	onSelect,
}: {
	selected: string[];
	multiple?: boolean;
	onSelect: (language: string) => void;
}) {
	const { t, language: interfaceLanguage } = useLanguage();
	return (
		<fieldset className="space-y-2">
			<legend className="text-sm font-medium">
				{multiple ? t("Languages") : t("Language")}
			</legend>
			<div className="flex flex-wrap gap-2">
				{[
					...supportedLanguages.filter(({ code }) => code === "hu"),
					...supportedLanguages.filter(({ code }) => code !== "hu"),
				].map((language) => (
					<Chip
						key={language.code}
						selected={selected.includes(language.code)}
						onClick={() => onSelect(language.code)}
					>
						<LanguageFlag code={language.code} />
						{languageLabel(language.code, interfaceLanguage, language.name)}
					</Chip>
				))}
			</div>
		</fieldset>
	);
}
