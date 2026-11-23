import { useLanguage } from "@/components/language-provider";
import type { RuntimeConfig } from "@/lib/config/schema";
import { NumberField, Section, SpeedField } from "./fields";

export function TorrentCard({
	config,
	update,
}: {
	config: RuntimeConfig;
	update: (recipe: (config: RuntimeConfig) => void) => void;
}) {
	const { t } = useLanguage();
	return (
		<Section title={t("Torrent client")}>
			<div className="grid gap-4 sm:grid-cols-2">
				<SpeedField
					label={t("Download limit")}
					value={config.torrent.downloadLimit}
					onChange={(value) =>
						update((next) => {
							next.torrent.downloadLimit = value;
						})
					}
				/>
				<SpeedField
					label={t("Upload limit")}
					value={config.torrent.uploadLimit}
					onChange={(value) =>
						update((next) => {
							next.torrent.uploadLimit = value;
						})
					}
				/>
				<NumberField
					label={t("Add timeout")}
					description={t(
						"Cancel when torrent metadata cannot be fetched within this time.",
					)}
					value={config.torrent.addTimeout / 1000}
					unit="seconds"
					min={1}
					valueResolution={1 / 1000}
					onChange={(value) =>
						update((next) => {
							next.torrent.addTimeout = Math.round(value * 1000);
						})
					}
				/>
				<NumberField
					label={t("Stream idle timeout")}
					description={t(
						"A stream is released after receiving no reads for this long.",
					)}
					value={config.torrent.idleTimeout / 1000}
					unit="seconds"
					min={1}
					valueResolution={1 / 1000}
					onChange={(value) =>
						update((next) => {
							next.torrent.idleTimeout = Math.round(value * 1000);
						})
					}
				/>
				<NumberField
					label={t("Torrent removal delay")}
					description={t(
						"How long an unused, non-seeding torrent remains loaded.",
					)}
					value={config.torrent.removeTimeout / 1000}
					unit="seconds"
					min={0}
					valueResolution={1 / 1000}
					onChange={(value) =>
						update((next) => {
							next.torrent.removeTimeout = Math.round(value * 1000);
						})
					}
				/>
				<NumberField
					label={t("Web request timeout")}
					description={t(
						"Cancel provider and metadata web requests after this time.",
					)}
					value={config.search.requestTimeout / 1000}
					unit="seconds"
					min={1}
					valueResolution={1 / 1000}
					onChange={(value) =>
						update((next) => {
							next.search.requestTimeout = Math.round(value * 1000);
						})
					}
				/>
			</div>
		</Section>
	);
}
