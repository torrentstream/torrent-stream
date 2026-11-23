import { Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
	ProviderId,
	RuntimeConfig,
	TorznabProviderConfig,
} from "@/lib/config/schema";
import {
	Chip,
	PasswordField,
	ProviderBox,
	type ProviderSortProps,
	Section,
	Toggle,
} from "./fields";
import { ProviderStatusLine } from "./provider-status";
import { moveItem, type ProviderOption } from "./shared";

export function ProvidersCard({
	config,
	providerOptions,
	update,
}: {
	config: RuntimeConfig;
	providerOptions: ProviderOption[];
	update: (recipe: (config: RuntimeConfig) => void) => void;
}) {
	const { t } = useLanguage();
	const fileMode = config.storage.mode === "file";
	const torrentio = config.providers.torrentio;
	const torznab = config.providers.torznab;
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
		<Section title={t("Torrent providers")}>
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
							{torrentio.enabled && <ProviderStatusLine provider={provider} />}
						</ProviderBox>
					);
				}

				if (provider === "torznab") {
					return (
						<TorznabProvider
							key={provider}
							name={optionsById.get(provider)?.name ?? provider}
							config={torznab}
							sort={sortProps(provider)}
							onChange={(providerConfig) =>
								update((next) => {
									next.providers.torznab = providerConfig;
								})
							}
						/>
					);
				}
				return null;
			})}
		</Section>
	);
}

function TorznabProvider({
	name,
	config,
	sort,
	onChange,
}: {
	name: string;
	config: TorznabProviderConfig;
	sort: ProviderSortProps;
	onChange: (config: TorznabProviderConfig) => void;
}) {
	const { t } = useLanguage();
	const configured =
		config.enabled && config.feeds.some((feed) => feed.url.trim());
	const change = (recipe: (next: TorznabProviderConfig) => void) => {
		const next = structuredClone(config);
		recipe(next);
		onChange(next);
	};

	return (
		<ProviderBox sort={sort}>
			<Toggle
				label={name}
				description={t(
					"Search one or more Jackett, Prowlarr, Harbrr, or other Torznab-compatible feeds.",
				)}
				checked={config.enabled}
				onChange={(enabled) =>
					change((next) => {
						next.enabled = enabled;
					})
				}
			/>
			{config.enabled && (
				<div className="mt-4 flex flex-col gap-4 border-t pt-4">
					{config.feeds.map((feed, index) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Feed rows have no persisted ID and only support append/remove.
							key={index}
							className="grid gap-4 rounded-lg border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
						>
							<div className="flex flex-col gap-2">
								<Label htmlFor={`torznab-url-${index}`}>
									{t("Endpoint URL")}
								</Label>
								<Input
									id={`torznab-url-${index}`}
									type="url"
									placeholder="http://localhost:9117/api/v2.0/indexers/all/results/torznab/api"
									value={feed.url}
									onChange={(event) =>
										change((next) => {
											next.feeds[index].url = event.target.value;
										})
									}
								/>
							</div>
							<PasswordField
								id={`torznab-api-key-${index}`}
								label={t("API key")}
								autoComplete="off"
								value={feed.apiKey}
								onChange={(apiKey) =>
									change((next) => {
										next.feeds[index].apiKey = apiKey;
									})
								}
							/>
							<Button
								type="button"
								variant="destructive"
								size="icon"
								className="self-end"
								aria-label={t("Remove Torznab feed {number}", {
									number: index + 1,
								})}
								onClick={() =>
									change((next) => {
										next.feeds.splice(index, 1);
									})
								}
							>
								<Trash2 />
							</Button>
						</div>
					))}
					<Button
						type="button"
						variant="outline"
						className="self-start"
						onClick={() =>
							change((next) => {
								next.feeds.push({ url: "", apiKey: "" });
							})
						}
					>
						<Plus />
						{t("Add feed")}
					</Button>
				</div>
			)}
			{configured && <ProviderStatusLine provider={sort.provider} />}
		</ProviderBox>
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
	const { t } = useLanguage();
	return (
		<div className="mt-4 border-t pt-4">
			<Toggle
				label={t("Enable all trackers")}
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
	const { t } = useLanguage();
	const configured = config.enabled && config.username && config.password;
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
						<Label htmlFor={`${name}-username`}>{t("Username")}</Label>
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
								label={t("Enable seeding")}
								description={t(
									"Keep torrents active until the provider no longer lists them as requiring seed.",
								)}
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
			{configured && <ProviderStatusLine provider={sort.provider} />}
		</ProviderBox>
	);
}
