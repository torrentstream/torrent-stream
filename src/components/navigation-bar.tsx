"use client";

import { Activity, ArrowLeft, Menu, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { InstallButton } from "./install-button";
import { Logo } from "./logo";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";

const links = [
	{ href: "/torrents", label: "Torrents", icon: Activity },
	{ href: "/config", label: "Configuration", icon: Settings },
];
const iconClass =
	"inline-flex size-10 items-center justify-center rounded-md transition hover:bg-accent hover:text-accent-foreground";

export function NavigationBar() {
	const pathname = usePathname();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	return (
		<nav
			className="sticky top-0 z-40 shrink-0 bg-card border-b"
			aria-label="Main navigation"
		>
			<div className="container mx-auto flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
				<div className="flex min-w-0 items-center gap-3">
					{/^\/(movie|tv)\/\d+$/.test(pathname) && (
						<button
							type="button"
							onClick={() => {
								if (window.history.length > 1) router.back();
								else router.replace("/");
							}}
							aria-label="Go back"
							title="Go back"
							className={`${iconClass} shrink-0`}
						>
							<ArrowLeft className="size-5" />
						</button>
					)}
					<Logo />
				</div>
				<div className="hidden items-center gap-2 sm:flex">
					{links.map(({ href, label, icon: Icon }) => (
						<Link
							key={href}
							href={href}
							aria-label={label}
							title={label}
							aria-current={pathname === href ? "page" : undefined}
							className={iconClass}
						>
							<Icon className="size-4" />
						</Link>
					))}
					<InstallButton />
				</div>
				<div className="sm:hidden">
					<Sheet open={open} onOpenChange={setOpen}>
						<SheetTrigger aria-label="Open menu" className={iconClass}>
							<Menu className="size-5" />
						</SheetTrigger>
						<SheetContent>
							<SheetTitle className="sr-only">Navigation</SheetTitle>
							<div className="flex flex-col gap-2 px-4 pt-16">
								{links.map(({ href, label, icon: Icon }) => (
									<Link
										key={href}
										href={href}
										onClick={() => setOpen(false)}
										aria-current={pathname === href ? "page" : undefined}
										className="flex min-h-11 items-center gap-3 rounded-md px-3 hover:bg-accent aria-[current=page]:bg-accent"
									>
										<Icon className="size-4" />
										{label}
									</Link>
								))}
								<div className="pt-2">
									<InstallButton fullWidth />
								</div>
							</div>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</nav>
	);
}
