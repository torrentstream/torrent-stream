import { useLanguage } from "@/components/language-provider";
import type { RuntimeConfig } from "@/lib/config/schema";
import { PasswordField, Section } from "./fields";

export function MetadataCard({
	config,
	update,
}: {
	config: RuntimeConfig;
	update: (recipe: (next: RuntimeConfig) => void) => void;
}) {
	const { t } = useLanguage();
	return (
		<Section title={t("Catalog")}>
			<div className="space-y-2">
				<PasswordField
					id="tmdb-api-key"
					label={t("TMDB API key")}
					autoComplete="off"
					value={config.tmdbApiKey || ""}
					onChange={(value) =>
						update((next) => {
							next.tmdbApiKey = value;
						})
					}
				/>
				<p className="text-xs leading-relaxed text-muted-foreground">
					{t(
						"Used for movie and TV metadata. Leave empty to use the default key. Get an API key from your",
					)}{" "}
					<a
						className="underline underline-offset-4"
						href="https://www.themoviedb.org/settings/api"
						target="_blank"
						rel="noreferrer"
					>
						{t("TMDB account")}
					</a>
					.
				</p>
			</div>
		</Section>
	);
}
