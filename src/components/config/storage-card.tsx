import { useId } from "react";
import { useLanguage } from "@/components/language-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RuntimeConfig } from "@/lib/config/schema";
import { NumberField, Section, Toggle } from "./fields";

export function StorageCard({
	config,
	update,
}: {
	config: RuntimeConfig;
	update: (recipe: (config: RuntimeConfig) => void) => void;
}) {
	const { t } = useLanguage();
	const storagePathId = useId();
	return (
		<Section title={t("Storage")}>
			<div className="grid grid-cols-2 gap-2">
				{(["memory", "file"] as const).map((mode) => (
					<button
						key={mode}
						type="button"
						onClick={() =>
							update((next) => {
								next.storage.mode = mode;
							})
						}
						className={`min-h-11 rounded-lg border px-4 py-3 text-left transition ${
							config.storage.mode === mode
								? "border-primary bg-primary/10"
								: "hover:bg-accent"
						}`}
					>
						<span className="block font-medium capitalize">{t(mode)}</span>
						<span className="text-xs text-muted-foreground">
							{mode === "memory"
								? t("No downloaded data is retained.")
								: t("Supports retention and seeding.")}
						</span>
					</button>
				))}
			</div>

			{config.storage.mode === "memory" ? (
				<NumberField
					label={t("Memory per stream")}
					description={t(
						"Maximum chunk cache allocated to each active stream.",
					)}
					value={config.storage.streamMemoryLimit / 1024 ** 2}
					unit="MB"
					min={1}
					valueResolution={1 / 1024 ** 2}
					onChange={(value) =>
						update((next) => {
							next.storage.streamMemoryLimit = Math.round(value * 1024 ** 2);
						})
					}
				/>
			) : (
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-2">
						<Label htmlFor={storagePathId}>{t("Torrent storage path")}</Label>
						<Input
							id={storagePathId}
							value={config.storage.path}
							onChange={(event) =>
								update((next) => {
									next.storage.path = event.target.value;
								})
							}
							placeholder="/data"
							autoComplete="off"
						/>
						<p className="text-xs leading-relaxed text-muted-foreground">
							{t(
								"Downloaded torrent data is stored here. The directory is created when you save.",
							)}
						</p>
					</div>
					<Toggle
						label={t("Keep downloaded files")}
						description={t(
							"Do not delete payload files when torrents leave the client.",
						)}
						checked={config.storage.keepFiles}
						onChange={(checked) =>
							update((next) => {
								next.storage.keepFiles = checked;
							})
						}
					/>
					<Toggle
						label={t("Download while idle")}
						description={t(
							"Continue downloading files that have already been streamed.",
						)}
						checked={config.storage.idleDownload}
						onChange={(checked) =>
							update((next) => {
								next.storage.idleDownload = checked;
							})
						}
					/>
				</div>
			)}
		</Section>
	);
}
