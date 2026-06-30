import { Settings } from "lucide-react";
import Link from "next/link";
import { InstallButton } from "./install-button";
import { Logo } from "./logo";

export function NavigationBar() {
	return (
		<nav className="bg-card border-b">
			<div className="container flex items-center justify-between mx-auto px-6 py-4">
				<Logo />
				<div className="flex items-center gap-3">
					<Link
						href="/config"
						aria-label="Configuration"
						title="Configuration"
						className="inline-flex size-9 items-center justify-center rounded-md transition hover:bg-accent hover:text-accent-foreground"
					>
						<Settings className="size-4" />
					</Link>
					<InstallButton />
				</div>
			</div>
		</nav>
	);
}
