import { InstallButton } from "./install-button";
import { Logo } from "./logo";

export function NavigationBar() {
	return (
		<nav className="bg-card border-b">
			<div className="container flex items-center justify-between mx-auto px-6 py-4">
				<Logo />
				<div className="flex items-center gap-3">
					<InstallButton />
				</div>
			</div>
		</nav>
	);
}
