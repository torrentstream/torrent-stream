import { ChevronDown, type LucideIcon } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

export function FilterSelect({
	icon: Icon,
	children,
	...props
}: SelectHTMLAttributes<HTMLSelectElement> & { icon: LucideIcon }) {
	return (
		<div className="relative min-w-0">
			<Icon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			<select
				{...props}
				className="min-h-11 w-full cursor-pointer appearance-none truncate rounded-full border bg-card pl-11 pr-10 text-sm font-medium shadow-xs transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-40"
			>
				{children}
			</select>
			<ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
		</div>
	);
}
