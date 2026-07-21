"use client";

import { Eye, EyeOff, GripVertical, RotateCcw, Save } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { type SaveConfigurationResult, saveConfiguration } from "@/app/actions";
import type {
	ProviderId,
	RuntimeConfig,
	SearchSortCriterion,
} from "@/lib/config/schema";
import { formatStrings, TorrentFormat } from "@/lib/media/format";
import { supportedLanguages } from "@/lib/media/language";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface Snapshot {
	config: RuntimeConfig;
	revision: string;
	warning?: string;
	providerOptions: ProviderOption[];
}

interface ProviderOption {
	id: ProviderId;
	name: string;
	trackers: { id: string; name: string }[];
}

function cloneConfig(config: RuntimeConfig) {
	return structuredClone(config);
}

function moveItem<T>(items: T[], moved: T, target: T) {
	const from = items.indexOf(moved);
	const to = items.indexOf(target);
	if (from < 0 || to < 0 || from === to) return;
	const [item] = items.splice(from, 1);
	items.splice(to, 0, item);
}

export function ConfigForm({ initialSnapshot }: { initialSnapshot: Snapshot }) {
	const [saved, setSaved] = useState(initialSnapshot);
	const [draft, setDraft] = useState(() => cloneConfig(initialSnapshot.config));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();
	const [message, setMessage] = useState<string>();
	const [confirmation, setConfirmation] = useState<
		Extract<SaveConfigurationResult, { requiresConfirmation: true }> | undefined
	>();

	const dirty = JSON.stringify(draft) !== JSON.stringify(saved.config);

	const update = (recipe: (next: RuntimeConfig) => void) => {
		setDraft((current) => {
			const next = cloneConfig(current);
			recipe(next);
			return next;
		});
		setMessage(undefined);
		setError(undefined);
	};

	const submit = async (confirmRestart = false) => {
		if (saving) return;
		setSaving(true);
		setError(undefined);
		setMessage(undefined);
		try {
			const result = await saveConfiguration(
				draft,
				saved.revision,
				confirmRestart,
			);
			if (result.requiresConfirmation) {
				setConfirmation(result);
				return;
			}
			const snapshot = {
				config: result.config,
				revision: result.revision,
				providerOptions: saved.providerOptions,
			};
			setSaved(snapshot);
			setDraft(cloneConfig(result.config));
			setConfirmation(undefined);
			setMessage(
				result.clientRestarted
					? `Saved. Torrent clients restarted${result.interruptedStreams ? ` and ${result.interruptedStreams} active stream${result.interruptedStreams === 1 ? " was" : "s were"} interrupted` : ""}.`
					: "Configuration saved and applied.",
			);
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Could not save configuration.",
			);
			setConfirmation(undefined);
		} finally {
			setSaving(false);
		}
	};

	return (
		<form
			className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-15"
			onSubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			{saved.warning && (
				<div
					role="alert"
					className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-200"
				>
					{saved.warning}
				</div>
			)}

			<StorageCard config={draft} update={update} />
			<TorrentCard config={draft} update={update} />
			<SearchCard config={draft} update={update} />
			<ProvidersCard
				config={draft}
				providerOptions={saved.providerOptions}
				update={update}
			/>

			<div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur">
				<div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
					<div className="min-w-0 text-sm">
						{error ? (
							<p role="alert" className="truncate text-destructive">
								{error}
							</p>
						) : message ? (
							<p className="truncate text-green-500">{message}</p>
						) : (
							<p className="text-muted-foreground">
								{dirty ? "You have unsaved changes." : "All changes saved."}
							</p>
						)}
					</div>
					<div className="flex shrink-0 gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={!dirty || saving}
							onClick={() => {
								setDraft(cloneConfig(saved.config));
								setError(undefined);
								setMessage(undefined);
							}}
							aria-label="Discard changes"
						>
							<RotateCcw />
							<span className="hidden sm:inline">Discard</span>
						</Button>
						<Button type="submit" disabled={!dirty || saving}>
							<Save />
							{saving ? "Saving…" : "Save"}
						</Button>
					</div>
				</div>
			</div>

			<Dialog
				open={Boolean(confirmation)}
				onOpenChange={(open) => {
					if (!open && !saving) setConfirmation(undefined);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Restart torrent clients?</DialogTitle>
						<DialogDescription>
							Changing storage mode or its data path rebuilds the torrent
							clients.{" "}
							{confirmation?.activeStreams
								? `${confirmation.activeStreams} active stream${confirmation.activeStreams === 1 ? "" : "s"} will be interrupted.`
								: "There are no active streams."}{" "}
							Downloaded files and seed state will be preserved.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>
							Cancel
						</DialogClose>
						<Button
							onClick={() => void submit(true)}
							disabled={saving}
							variant="destructive"
						>
							Restart and save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</form>
	);
}

function StorageCard({
	config,
	update,
}: {
	config: RuntimeConfig;
	update: (recipe: (config: RuntimeConfig) => void) => void;
}) {
	const storagePathId = useId();
	return (
		<Section
			title="Storage"
			description="Choose whether streamed pieces live in memory or on disk."
		>
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
						<span className="block font-medium capitalize">{mode}</span>
						<span className="text-xs text-muted-foreground">
							{mode === "memory"
								? "No downloaded data is retained."
								: "Supports retention and seeding."}
						</span>
					</button>
				))}
			</div>

			{config.storage.mode === "memory" ? (
				<NumberField
					label="Memory per stream"
					description="Maximum chunk cache allocated to each active stream."
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
						<Label htmlFor={storagePathId}>Torrent storage path</Label>
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
							Downloaded torrent data is stored here. The directory is created
							when you save.
						</p>
					</div>
					<Toggle
						label="Keep downloaded files"
						description="Do not delete payload files when torrents leave the client."
						checked={config.storage.keepFiles}
						onChange={(checked) =>
							update((next) => {
								next.storage.keepFiles = checked;
							})
						}
					/>
					<Toggle
						label="Download while idle"
						description="Continue downloading files that have already been streamed."
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

function TorrentCard({
	config,
	update,
}: {
	config: RuntimeConfig;
	update: (recipe: (config: RuntimeConfig) => void) => void;
}) {
	return (
		<Section
			title="Torrent client"
			description="Transfer limits apply live. Use 0 to block traffic or Unlimited to remove throttling."
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<SpeedField
					label="Download limit"
					value={config.torrent.downloadLimit}
					onChange={(value) =>
						update((next) => {
							next.torrent.downloadLimit = value;
						})
					}
				/>
				<SpeedField
					label="Upload limit"
					value={config.torrent.uploadLimit}
					onChange={(value) =>
						update((next) => {
							next.torrent.uploadLimit = value;
						})
					}
				/>
				<NumberField
					label="Add timeout"
					description="Cancel when torrent metadata cannot be fetched within this time."
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
					label="Stream idle timeout"
					description="A stream is released after receiving no reads for this long."
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
					label="Torrent removal delay"
					description="How long an unused, non-seeding torrent remains loaded."
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
					label="Web request timeout"
					description="Cancel provider and metadata web requests after this time."
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

function SearchCard({
	config,
	update,
}: {
	config: RuntimeConfig;
	update: (recipe: (config: RuntimeConfig) => void) => void;
}) {
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
		<Section
			title="Search filters"
			description="Results containing any excluded detected format are filtered out."
		>
			<div>
				<div className="mb-2 flex items-center justify-between">
					<Label>Formats</Label>
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
						{allFormatsSelected ? "Clear all" : "Allow all"}
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
					<Label>Languages</Label>
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
							{allLanguagesSelected ? "Clear all" : "Allow all"}
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
								{language.flag} {language.name}
							</Chip>
						);
					})}
				</div>
			</div>

			<div>
				<Label>Sort priority</Label>
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
							{criterion[0].toUpperCase() + criterion.slice(1)}
						</Badge>
					))}
				</div>
			</div>
		</Section>
	);
}

function ProvidersCard({
	config,
	providerOptions,
	update,
}: {
	config: RuntimeConfig;
	providerOptions: ProviderOption[];
	update: (recipe: (config: RuntimeConfig) => void) => void;
}) {
	const fileMode = config.storage.mode === "file";
	const torrentio = config.providers.torrentio;
	const optionsById = new Map(
		providerOptions.map((provider) => [provider.id, provider]),
	);
	const draggedProvider = useRef<ProviderId | undefined>(undefined);
	const sortProps = (provider: ProviderId): ProviderSortProps => ({
		provider,
		name: optionsById.get(provider)?.name ?? provider,
		draggedProvider,
		onMove: (dragged, target) =>
			update((next) => {
				moveItem(next.search.providerOrder, dragged, target);
			}),
	});

	return (
		<Section
			title="Providers"
			description="Enable search providers and choose which sources Torrentio may use."
		>
			{config.search.providerOrder.map((provider) => {
				if (provider === "ncore" || provider === "insane") {
					return (
						<PrivateProvider
							key={provider}
							name={optionsById.get(provider)?.name ?? provider}
							config={config.providers[provider]}
							fileMode={fileMode}
							sort={sortProps(provider)}
							onChange={(providerConfig) =>
								update((next) => {
									next.providers[provider] = providerConfig;
								})
							}
						/>
					);
				}

				if (provider === "torrentio") {
					return (
						<ProviderBox key={provider} sort={sortProps(provider)}>
							<Toggle
								label={optionsById.get(provider)?.name ?? provider}
								checked={torrentio.enabled}
								onChange={(checked) =>
									update((next) => {
										next.providers.torrentio.enabled = checked;
									})
								}
							/>
							{torrentio.enabled && (
								<TorrentioTrackers
									trackers={optionsById.get(provider)?.trackers ?? []}
									selected={torrentio.sources}
									allTrackers={torrentio.allTrackers}
									onAllTrackersChange={(allTrackers) =>
										update((next) => {
											next.providers.torrentio.allTrackers = allTrackers;
										})
									}
									onChange={(sources) =>
										update((next) => {
											next.providers.torrentio.sources = sources;
										})
									}
								/>
							)}
						</ProviderBox>
					);
				}
				return null;
			})}
		</Section>
	);
}

function TorrentioTrackers({
	trackers,
	selected,
	allTrackers,
	onAllTrackersChange,
	onChange,
}: {
	trackers: { id: string; name: string }[];
	selected: string[];
	allTrackers: boolean;
	onAllTrackersChange: (enabled: boolean) => void;
	onChange: (sources: string[]) => void;
}) {
	return (
		<div className="mt-4 border-t pt-4">
			<Toggle
				label="Enable all trackers"
				checked={allTrackers}
				onChange={onAllTrackersChange}
			/>
			<div
				className={`mt-3 flex flex-wrap gap-2 transition-opacity ${
					allTrackers ? "opacity-50" : ""
				}`}
			>
				{trackers.map((tracker) => (
					<Chip
						key={tracker.id}
						selected={allTrackers || selected.includes(tracker.id)}
						disabled={allTrackers}
						onClick={() =>
							onChange(
								selected.includes(tracker.id)
									? selected.filter((id) => id !== tracker.id)
									: [...selected, tracker.id],
							)
						}
					>
						{tracker.name}
					</Chip>
				))}
			</div>
		</div>
	);
}

type PrivateProviderConfig = RuntimeConfig["providers"]["ncore"];

function PrivateProvider({
	name,
	config,
	fileMode,
	sort,
	onChange,
}: {
	name: string;
	config: PrivateProviderConfig;
	fileMode: boolean;
	sort: ProviderSortProps;
	onChange: (config: PrivateProviderConfig) => void;
}) {
	const change = (recipe: (next: PrivateProviderConfig) => void) => {
		const next = structuredClone(config);
		recipe(next);
		onChange(next);
	};
	return (
		<ProviderBox sort={sort}>
			<Toggle
				label={name}
				checked={config.enabled}
				onChange={(checked) =>
					change((next) => {
						next.enabled = checked;
					})
				}
			/>
			{config.enabled && (
				<div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor={`${name}-username`}>Username</Label>
						<Input
							id={`${name}-username`}
							value={config.username}
							autoComplete="username"
							onChange={(event) =>
								change((next) => {
									next.username = event.target.value;
								})
							}
						/>
					</div>
					<PasswordField
						id={`${name}-password`}
						value={config.password}
						onChange={(value) =>
							change((next) => {
								next.password = value;
							})
						}
					/>
					{fileMode && (
						<div className="sm:col-span-2">
							<Toggle
								label="Enable seeding"
								description="Keep torrents active until the provider no longer lists them as requiring seed."
								checked={config.seeding}
								onChange={(seeding) =>
									change((next) => {
										next.seeding = seeding;
									})
								}
							/>
						</div>
					)}
				</div>
			)}
		</ProviderBox>
	);
}

function Section({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">{children}</CardContent>
		</Card>
	);
}

interface ProviderSortProps {
	provider: ProviderId;
	name: string;
	draggedProvider: React.RefObject<ProviderId | undefined>;
	onMove: (dragged: ProviderId, target: ProviderId) => void;
}

function ProviderBox({
	children,
	sort,
}: {
	children: React.ReactNode;
	sort?: ProviderSortProps;
}) {
	return (
		<fieldset
			aria-label={sort ? `${sort.name} provider` : undefined}
			className="rounded-xl border p-4"
			onDragEnter={(event) => {
				if (!sort) return;
				const dragged = sort.draggedProvider.current;
				if (!dragged || dragged === sort.provider) return;
				event.preventDefault();
				sort.onMove(dragged, sort.provider);
			}}
			onDragOver={(event) => {
				if (sort?.draggedProvider.current) event.preventDefault();
			}}
			onDrop={(event) => {
				if (!sort) return;
				event.preventDefault();
				sort.draggedProvider.current = undefined;
			}}
		>
			{sort ? (
				<div className="flex items-start gap-2">
					<button
						type="button"
						draggable
						aria-label={`Reorder ${sort.name}`}
						className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
						onDragStart={(event) => {
							sort.draggedProvider.current = sort.provider;
							event.dataTransfer.effectAllowed = "move";
							event.dataTransfer.setData("text/plain", sort.provider);
						}}
						onDragEnd={() => {
							sort.draggedProvider.current = undefined;
						}}
					>
						<GripVertical className="size-5" />
					</button>
					<div className="min-w-0 flex-1">{children}</div>
				</div>
			) : (
				children
			)}
		</fieldset>
	);
}

function Toggle({
	label,
	description,
	checked,
	disabled = false,
	onChange,
}: {
	label: string;
	description?: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label
			className={`flex justify-between gap-4 ${
				description ? "min-h-11 items-start" : "items-center"
			} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
		>
			<span>
				<span className="block font-medium">{label}</span>
				{description && (
					<span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
						{description}
					</span>
				)}
			</span>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
				className="mt-0.5 size-5 shrink-0 accent-primary"
			/>
		</label>
	);
}

function NumberField({
	label,
	description,
	value,
	unit,
	min,
	step = 1,
	valueResolution = 0,
	onChange,
}: {
	label: string;
	description?: string;
	value: number;
	unit?: string;
	min?: number;
	step?: number | "any";
	valueResolution?: number;
	onChange: (value: number) => void;
}) {
	const id = useId();
	const normalizedValue = String(Number.isFinite(value) ? value : 0);
	const [inputValue, setInputValue] = useState(normalizedValue);
	const [editing, setEditing] = useState(false);

	useEffect(() => {
		if (editing) return;
		const displayedValue = Number(inputValue);
		const tolerance =
			valueResolution / 2 +
			Number.EPSILON * Math.max(Math.abs(value), Math.abs(displayedValue), 1);
		if (
			Number.isFinite(displayedValue) &&
			Math.abs(displayedValue - value) <= tolerance
		) {
			return;
		}
		setInputValue(normalizedValue);
	}, [editing, inputValue, normalizedValue, value, valueResolution]);

	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			<div className="flex items-center gap-2">
				<Input
					id={id}
					type="number"
					value={inputValue}
					min={min}
					step={step}
					onFocus={() => setEditing(true)}
					onChange={(event) => {
						setInputValue(event.target.value);
						const parsed = event.target.valueAsNumber;
						if (Number.isFinite(parsed)) onChange(parsed);
					}}
					onBlur={(event) => {
						setEditing(false);
						const parsed = event.target.valueAsNumber;
						if (Number.isFinite(parsed)) {
							onChange(parsed);
						} else {
							setInputValue(normalizedValue);
						}
					}}
				/>
				{unit && (
					<span className="shrink-0 text-sm text-muted-foreground">{unit}</span>
				)}
			</div>
			{description && (
				<p className="text-xs leading-relaxed text-muted-foreground">
					{description}
				</p>
			)}
		</div>
	);
}

function SpeedField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
}) {
	const unlimited = value < 0;
	const id = useId();
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<Label htmlFor={id}>{label}</Label>
				<label className="flex items-center gap-2 text-xs text-muted-foreground">
					<input
						type="checkbox"
						checked={unlimited}
						onChange={(event) =>
							onChange(
								event.target.checked
									? -1
									: Math.max(0, value < 0 ? 10 * 1024 ** 2 : value),
							)
						}
						className="size-4 accent-primary"
					/>
					Unlimited
				</label>
			</div>
			<div className="flex items-center gap-2">
				<Input
					id={id}
					type="number"
					min={0}
					step={1}
					disabled={unlimited}
					value={unlimited ? "" : value}
					placeholder="Unlimited"
					onChange={(event) => onChange(Math.round(Number(event.target.value)))}
				/>
				<span className="shrink-0 text-sm text-muted-foreground">B/s</span>
			</div>
		</div>
	);
}

function PasswordField({
	id,
	value,
	onChange,
}: {
	id: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const [visible, setVisible] = useState(false);
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>Password</Label>
			<div className="relative">
				<Input
					id={id}
					type={visible ? "text" : "password"}
					value={value}
					autoComplete="current-password"
					onChange={(event) => onChange(event.target.value)}
					className="pr-10"
				/>
				<button
					type="button"
					className="absolute right-0 top-0 flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
					onClick={() => setVisible((current) => !current)}
					aria-label={visible ? "Hide password" : "Show password"}
					aria-pressed={visible}
				>
					{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
				</button>
			</div>
		</div>
	);
}

function Chip({
	selected,
	onClick,
	disabled = false,
	draggable = false,
	onDragStart,
	onDragEnter,
	onDragOver,
	onDrop,
	onDragEnd,
	children,
}: {
	selected: boolean;
	onClick: () => void;
	disabled?: boolean;
	draggable?: boolean;
	onDragStart?: React.DragEventHandler<HTMLButtonElement>;
	onDragEnter?: React.DragEventHandler<HTMLButtonElement>;
	onDragOver?: React.DragEventHandler<HTMLButtonElement>;
	onDrop?: React.DragEventHandler<HTMLButtonElement>;
	onDragEnd?: React.DragEventHandler<HTMLButtonElement>;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onClick}
			disabled={disabled}
			draggable={draggable}
			onDragStart={onDragStart}
			onDragEnter={onDragEnter}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onDragEnd={onDragEnd}
			className={`min-h-9 rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed ${
				draggable ? "cursor-grab active:cursor-grabbing " : ""
			}${
				selected
					? "border-primary bg-primary text-primary-foreground"
					: "hover:bg-accent"
			}`}
		>
			{children}
		</button>
	);
}
