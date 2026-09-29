"use client";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

export function BrowseSearch({
	query,
	onSearch,
}: {
	query: string;
	onSearch: (query: string) => void;
}) {
	const [value, setValue] = useState(query);
	useEffect(() => setValue(query), [query]);
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				onSearch(value.trim());
			}}
			className="flex w-full min-w-0 items-center gap-1 rounded-full border bg-card p-1 pl-4 focus-within:ring-2 focus-within:ring-ring xl:w-auto xl:flex-1"
		>
			<input
				aria-label="Search movies and shows"
				placeholder="Search movies & shows"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				maxLength={200}
				className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none sm:text-sm"
			/>
			{value && (
				<button
					type="button"
					aria-label="Clear search"
					onClick={() => {
						setValue("");
						onSearch("");
					}}
					className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-accent"
				>
					<X className="size-4" />
				</button>
			)}
			<button
				type="submit"
				aria-label="Search"
				className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary hover:bg-accent"
			>
				<Search className="size-4" />
			</button>
		</form>
	);
}
