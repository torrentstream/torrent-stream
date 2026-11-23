import { useRef } from "react";
import { LanguageFlag } from "@/components/language-flag";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { RuntimeConfig, SearchSortCriterion } from "@/lib/config/schema";
import { languageLabel } from "@/lib/i18n";
import { formatStrings, TorrentFormat } from "@/lib/media/format";
import { supportedLanguages } from "@/lib/media/language";
import { Chip, Section } from "./fields";
import { moveItem } from "./shared";

export function SearchCard({
	config,
	update,
}: {
	config: RuntimeConfig;
	update: (recipe: (config: RuntimeConfig) => void) => void;
}) {
	const { t, language: interfaceLanguage } = useLanguage();
	const allFormats = Object.values(TorrentFormat);
	const allLanguages = supportedLanguages.map(({ code }) => code);
	const allFormatsSelected = config.search.formats.length === allFormats.length;
	const allLanguagesSelected =
		config.search.languages.length === allLanguages.length;
	const draggedSortCriterion = useRef<SearchSortCriterion | undefined>(
		undefined,
	);
	const draggedLanguage = useRef<string | undefined>(undefined);
	const languageWasDragged = useRef(false);
	const languagesByCode = new Map<string, (typeof supportedLanguages)[number]>(
		supportedLanguages.map((language) => [language.code, language]),
	);
	const orderedLanguages = [
		...config.search.languages
			.map((code) => languagesByCode.get(code))
			.filter((language) => language !== undefined),
		...supportedLanguages.filter(
			(language) => !config.search.languages.includes(language.code),
		),
	];

	return (
		<Section title={t("Torrent search")}>
			<div>
				<div className="mb-2 flex items-center justify-between">
					<Label>{t("Formats")}</Label>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							update((next) => {
								next.search.formats = allFormatsSelected ? [] : [...allFormats];
							})
						}
					>
						{allFormatsSelected ? t("Clear all") : t("Allow all")}
					</Button>
				</div>
				<div className="flex flex-wrap gap-2">
					{allFormats.map((format) => {
						const selected = config.search.formats.includes(format);
						return (
							<Chip
								key={format}
								selected={selected}
								onClick={() =>
									update((next) => {
										next.search.formats = selected
											? next.search.formats.filter((value) => value !== format)
											: [...next.search.formats, format];
									})
								}
							>
								{formatStrings[format]}
							</Chip>
						);
					})}
				</div>
			</div>

			<div>
				<div className="mb-2 flex items-center justify-between">
					<Label>{t("Languages")}</Label>
					<div className="flex gap-1">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								update((next) => {
									next.search.languages = allLanguagesSelected
										? []
										: [...allLanguages];
								})
							}
						>
							{allLanguagesSelected ? t("Clear all") : t("Allow all")}
						</Button>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					{orderedLanguages.map((language) => {
						const selected = config.search.languages.includes(language.code);
						return (
							<Chip
								key={language.code}
								selected={selected}
								draggable={selected}
								onDragStart={(event) => {
									languageWasDragged.current = true;
									draggedLanguage.current = language.code;
									event.dataTransfer.effectAllowed = "move";
									event.dataTransfer.setData("text/plain", language.code);
								}}
								onDragEnter={(event) => {
									const draggedCode = draggedLanguage.current;
									if (
										!selected ||
										!draggedCode ||
										draggedCode === language.code
									) {
										return;
									}
									event.preventDefault();
									update((next) => {
										moveItem(next.search.languages, draggedCode, language.code);
									});
								}}
								onDragOver={(event) => {
									if (selected && draggedLanguage.current)
										event.preventDefault();
								}}
								onDrop={(event) => {
									event.preventDefault();
									draggedLanguage.current = undefined;
								}}
								onDragEnd={() => {
									draggedLanguage.current = undefined;
									setTimeout(() => {
										languageWasDragged.current = false;
									}, 0);
								}}
								onClick={() => {
									if (languageWasDragged.current) return;
									update((next) => {
										next.search.languages = selected
											? next.search.languages.filter(
													(value) => value !== language.code,
												)
											: [...next.search.languages, language.code];
									});
								}}
							>
								<LanguageFlag code={language.code} />
								{languageLabel(language.code, interfaceLanguage, language.name)}
							</Chip>
						);
					})}
				</div>
			</div>

			<div>
				<Label>{t("Sort priority")}</Label>
				<div className="mt-2 flex flex-wrap gap-2">
					{config.search.sortPriority.map((criterion) => (
						<Badge
							key={criterion}
							variant="outline"
							draggable
							className="h-9 cursor-grab px-3 text-sm active:cursor-grabbing"
							onDragStart={(event) => {
								draggedSortCriterion.current = criterion;
								event.dataTransfer.effectAllowed = "move";
								event.dataTransfer.setData("text/plain", criterion);
							}}
							onDragEnter={(event) => {
								const dragged = draggedSortCriterion.current;
								if (!dragged || dragged === criterion) return;
								event.preventDefault();
								update((next) => {
									moveItem(next.search.sortPriority, dragged, criterion);
								});
							}}
							onDragOver={(event) => {
								if (draggedSortCriterion.current) event.preventDefault();
							}}
							onDrop={(event) => {
								event.preventDefault();
								draggedSortCriterion.current = undefined;
							}}
							onDragEnd={() => {
								draggedSortCriterion.current = undefined;
							}}
						>
							{t(criterion[0].toUpperCase() + criterion.slice(1))}
						</Badge>
					))}
				</div>
			</div>
		</Section>
	);
}
