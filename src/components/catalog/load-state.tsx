import { LoaderCircle } from "lucide-react";

export function Loading({
	children = "Loading…",
}: {
	children?: React.ReactNode;
}) {
	return (
		<output className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
			<LoaderCircle className="size-5 animate-spin" />
			{children}
		</output>
	);
}

export function LoadError({
	error,
	retry,
}: {
	error: Error;
	retry: () => void;
}) {
	return (
		<div
			role="alert"
			className="rounded-xl border border-border bg-card p-6 text-center"
		>
			<p className="text-muted-foreground">{error.message}</p>
			<button
				type="button"
				onClick={retry}
				className="mt-4 rounded-lg bg-secondary px-5 py-2 text-sm font-medium hover:bg-accent"
			>
				Try again
			</button>
		</div>
	);
}
