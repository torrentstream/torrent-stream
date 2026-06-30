"use client";

import { Eye, EyeOff, RotateCcw, Save } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { type SaveConfigurationResult, saveConfiguration } from "@/app/actions";
import {
	type RuntimeConfig,
	type SeedPolicy,
	type TorrentioSourceId,
	torrentioSourceIds,
} from "@/lib/config-schema";
import { formatStrings, TorrentFormat } from "@/lib/format";
import { supportedLanguages } from "@/lib/language";
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
}

function cloneConfig(config: RuntimeConfig) {
	return structuredClone(config);
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
			className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-[3.75rem]"
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
			<ProvidersCard config={draft} update={update} />

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
					{supportedLanguages.map((language) => {
						const selected = config.search.languages.includes(language.code);
						return (
							<Chip
								key={language.code}
								selected={selected}
								onClick={() =>
									update((next) => {
										next.search.languages = selected
											? next.search.languages.filter(
													(value) => value !== language.code,
												)
											: [...next.search.languages, language.code];
									})
								}
							>
								{language.flag} {language.name}
							</Chip>
						);
					})}
				</div>
			</div>
		</Section>
	);
}

function ProvidersCard({
	config,
	update,
}: {
	config: RuntimeConfig;
	update: (recipe: (config: RuntimeConfig) => void) => void;
}) {
	const fileMode = config.storage.mode === "file";
	const torrentio = config.providers.torrentio;

	return (
		<Section
			title="Providers"
			description="Use Torrentio for every public source, or turn it off and select individual sources."
		>
			<PrivateProvider
				name="nCore"
				config={config.providers.ncore}
				fileMode={fileMode}
				onChange={(provider) =>
					update((next) => {
						next.providers.ncore = provider;
					})
				}
			/>
			<PrivateProvider
				name="iNSANE"
				config={config.providers.insane}
				fileMode={fileMode}
				onChange={(provider) =>
					update((next) => {
						next.providers.insane = provider;
					})
				}
			/>

			<ProviderBox>
				<Toggle
					label="Torrentio"
					checked={torrentio.enabled}
					onChange={(checked) =>
						update((next) => {
							next.providers.torrentio.enabled = checked;
							for (const source of torrentioSourceIds) {
								next.providers[source].enabled = false;
							}
						})
					}
				/>
				{fileMode && torrentio.enabled && (
					<SeedPolicyControl
						policy={torrentio.seed}
						onChange={(policy) =>
							update((next) => {
								next.providers.torrentio.seed = policy;
							})
						}
					/>
				)}
			</ProviderBox>

			{torrentioSourceIds.map((source) => {
				const sourceConfig = config.providers[source];
				return (
					<ProviderBox key={source} disabled={torrentio.enabled}>
						<Toggle
							label={sourceName(source)}
							checked={torrentio.enabled ? false : sourceConfig.enabled}
							disabled={torrentio.enabled}
							onChange={(checked) =>
								update((next) => {
									next.providers[source].enabled = checked;
									if (checked) next.providers.torrentio.enabled = false;
								})
							}
						/>
						{fileMode && sourceConfig.enabled && !torrentio.enabled && (
							<SeedPolicyControl
								policy={sourceConfig.seed}
								onChange={(policy) =>
									update((next) => {
										next.providers[source].seed = policy;
									})
								}
							/>
						)}
					</ProviderBox>
				);
			})}
		</Section>
	);
}

type PrivateProviderConfig = RuntimeConfig["providers"]["ncore"];

function PrivateProvider({
	name,
	config,
	fileMode,
	onChange,
}: {
	name: string;
	config: PrivateProviderConfig;
	fileMode: boolean;
	onChange: (config: PrivateProviderConfig) => void;
}) {
	const change = (recipe: (next: PrivateProviderConfig) => void) => {
		const next = structuredClone(config);
		recipe(next);
		onChange(next);
	};
	return (
		<ProviderBox>
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
							<SeedPolicyControl
								policy={config.seed}
								onChange={(policy) =>
									change((next) => {
										next.seed = policy;
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

function SeedPolicyControl({
	policy,
	onChange,
}: {
	policy: SeedPolicy;
	onChange: (policy: SeedPolicy) => void;
}) {
	const setEnabled = (enabled: boolean) => {
		const next = structuredClone(policy);
		next.enabled = enabled;
		if (enabled && next.ratio === 0 && next.timeSeconds === 0) next.ratio = 1;
		onChange(next);
	};
	return (
		<div className="mt-4 border-t pt-4">
			<Toggle
				label="Enable seeding"
				checked={policy.enabled}
				onChange={setEnabled}
			/>
			{policy.enabled && <SeedEditor policy={policy} onChange={onChange} />}
		</div>
	);
}

function SeedEditor({
	policy,
	onChange,
}: {
	policy: SeedPolicy;
	onChange: (policy: SeedPolicy) => void;
}) {
	const change = (recipe: (next: SeedPolicy) => void) => {
		const next = structuredClone(policy);
		recipe(next);
		onChange(next);
	};
	return (
		<div className="mt-3 grid gap-4 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
			<NumberField
				label="Ratio target"
				description="Use 0 to disable ratio completion."
				value={policy.ratio}
				min={0}
				step="any"
				onChange={(value) =>
					change((next) => {
						next.ratio = value;
					})
				}
			/>
			<NumberField
				label="Time target"
				description="Use 0 to disable time completion."
				value={policy.timeSeconds}
				unit="seconds"
				min={0}
				step={1}
				onChange={(value) =>
					change((next) => {
						next.timeSeconds = value;
					})
				}
			/>
			{policy.timeSeconds > 0 && (
				<>
					<NumberField
						label="Extra time per"
						description="The amount of downloaded data that adds the extra time."
						value={policy.timeIncrementBytes}
						unit="bytes"
						min={1}
						step={1}
						onChange={(value) =>
							change((next) => {
								next.timeIncrementBytes = value;
							})
						}
					/>
					<NumberField
						label="Extra time added"
						description="Added for every configured downloaded amount."
						value={policy.timeIncrementSeconds}
						unit="seconds"
						min={0}
						step={1}
						onChange={(value) =>
							change((next) => {
								next.timeIncrementSeconds = value;
							})
						}
					/>
					<Toggle
						label="Ratio time discount"
						description="Reduce required time as upload ratio approaches its target."
						checked={policy.ratioDiscount}
						onChange={(checked) =>
							change((next) => {
								next.ratioDiscount = checked;
							})
						}
					/>
				</>
			)}
			<p className="text-xs text-muted-foreground sm:col-span-2">
				The torrent is released when either its ratio or time target is met.
			</p>
		</div>
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

function ProviderBox({
	children,
	disabled = false,
}: {
	children: React.ReactNode;
	disabled?: boolean;
}) {
	return (
		<div
			className={`rounded-xl border p-4 transition-opacity ${
				disabled ? "opacity-50" : ""
			}`}
		>
			{children}
		</div>
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
	children,
}: {
	selected: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onClick}
			className={`min-h-9 rounded-full border px-3 py-1.5 text-sm transition ${
				selected
					? "border-primary bg-primary text-primary-foreground"
					: "hover:bg-accent"
			}`}
		>
			{children}
		</button>
	);
}

function sourceName(source: TorrentioSourceId) {
	const names: Partial<Record<TorrentioSourceId, string>> = {
		yts: "YTS",
		eztv: "EZTV",
		rarbg: "RARBG",
		thepiratebay: "The Pirate Bay",
		kickasstorrents: "KickassTorrents",
		torrentgalaxy: "TorrentGalaxy",
		horriblesubs: "HorribleSubs",
		nyaasi: "Nyaa.si",
		tokyotosho: "Tokyo Toshokan",
		rutracker: "RuTracker",
		micoleaodublado: "Mico Leão Dublado",
		ilcorsaronero: "Il Corsaro Nero",
		mejortorrent: "MejorTorrent",
		wolfmax4k: "WolfMax4K",
		cinecalidad: "Cinecalidad",
		besttorrents: "BestTorrents",
	};
	return names[source] ?? source[0].toUpperCase() + source.slice(1);
}
