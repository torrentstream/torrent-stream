"use client";

import { RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { mutate } from "swr";
import { type SaveConfigurationResult, saveConfiguration } from "@/app/actions";
import { useLanguage } from "@/components/language-provider";
import type { RuntimeConfig } from "@/lib/config/schema";
import { MetadataCard } from "./config/metadata-card";
import { ProvidersCard } from "./config/providers-card";
import { SearchCard } from "./config/search-card";
import type { Snapshot } from "./config/shared";
import { StorageCard } from "./config/storage-card";
import { SubtitlesCard } from "./config/subtitles-card";
import { TorrentCard } from "./config/torrent-card";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";

function cloneConfig(config: RuntimeConfig) {
	return structuredClone(config);
}

export function ConfigForm({ initialSnapshot }: { initialSnapshot: Snapshot }) {
	const { t } = useLanguage();
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
			void mutate("provider-status");
			// Lists found with the old search settings must not be shown again.
			void mutate(
				(key) => typeof key === "string" && key.startsWith("/api/stream/"),
				undefined,
				{ revalidate: false },
			);
			setDraft(cloneConfig(result.config));
			setConfirmation(undefined);
			setMessage(
				result.clientRestarted
					? result.interruptedStreams
						? t(
								"Saved. Torrent clients restarted and {count} active streams interrupted.",
								{ count: result.interruptedStreams },
							)
						: t("Saved. Torrent clients restarted.")
					: t("Configuration saved and applied."),
			);
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: t("Could not save configuration."),
			);
			setConfirmation(undefined);
		} finally {
			setSaving(false);
		}
	};

	return (
		<form
			className="mx-auto flex w-full flex-col gap-6 pb-16"
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
					{t(saved.warning)}
				</div>
			)}

			<MetadataCard config={draft} update={update} />
			<SubtitlesCard config={draft} update={update} />
			<StorageCard config={draft} update={update} />
			<TorrentCard config={draft} update={update} />
			<SearchCard config={draft} update={update} />
			<ProvidersCard
				config={draft}
				providerOptions={saved.providerOptions}
				update={update}
			/>

			<div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 py-3 backdrop-blur">
				<div className="container mx-auto flex items-center justify-between gap-3 px-4 sm:px-6">
					<div className="min-w-0 text-sm">
						{error ? (
							<p role="alert" className="truncate text-destructive">
								{t(error)}
							</p>
						) : message ? (
							<p className="truncate text-green-500">{t(message)}</p>
						) : (
							<p className="text-muted-foreground">
								{dirty
									? t("You have unsaved changes.")
									: t("All changes saved.")}
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
							aria-label={t("Discard changes")}
						>
							<RotateCcw />
							<span className="hidden sm:inline">{t("Discard")}</span>
						</Button>
						<Button type="submit" disabled={!dirty || saving}>
							<Save />
							{saving ? t("Saving…") : t("Save")}
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
						<DialogTitle>{t("Restart torrent clients?")}</DialogTitle>
						<DialogDescription>
							{t(
								"Changing storage mode or its data path rebuilds the torrent clients.",
							)}{" "}
							{confirmation?.activeStreams
								? t("{count} active streams will be interrupted.", {
										count: confirmation.activeStreams,
									})
								: t("There are no active streams.")}{" "}
							{t("Downloaded files and seed state will be preserved.")}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>
							{t("Cancel")}
						</DialogClose>
						<Button
							onClick={() => void submit(true)}
							disabled={saving}
							variant="destructive"
						>
							{t("Restart and save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</form>
	);
}
