import useSWR from "swr";
import { getProviderStatus } from "@/app/actions";
import { useLanguage } from "@/components/language-provider";
import type { ProviderId } from "@/lib/config/schema";

/**
 * Health of the running (saved) provider, not of the unsaved draft: whether
 * its last search and its last seed check worked. Empty until either has run.
 * The server only reads this from memory; it is loaded when the page opens,
 * when the tab regains focus and after saving.
 */
export function ProviderStatusLine({ provider }: { provider: ProviderId }) {
	const { t } = useLanguage();
	const { data } = useSWR("provider-status", getProviderStatus);

	const { search, seedCheck } = data?.[provider] ?? {};
	if (!search && !seedCheck) return null;

	const error =
		search?.ok === false
			? search
			: seedCheck?.outcome === "failed"
				? seedCheck
				: undefined;

	return (
		<p className="mt-4 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
			{t("Status:")}
			<span
				className={`size-2 shrink-0 rounded-full ${error ? "bg-destructive" : "bg-emerald-500"}`}
			/>
			{error ? (
				<span className="text-destructive">
					{t("Not working")}
					{error.message && `: ${error.message}`}
				</span>
			) : (
				t("Working")
			)}
		</p>
	);
}
