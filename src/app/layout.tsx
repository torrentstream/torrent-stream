import type { Metadata, Viewport } from "next";
import { NavigationBar } from "@/components/navigation-bar";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
	title: "torrent-stream.",
	description: "Browse movies and series and stream your torrents.",
	applicationName: "torrent-stream.",
	appleWebApp: {
		capable: true,
		title: "torrent-stream.",
		statusBarStyle: "default",
	},
	icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: "#171717",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<ThemeProvider attribute="class" defaultTheme="dark">
					<div className="min-h-screen flex flex-col overflow-x-clip">
						<NavigationBar />
						<main className="mx-auto w-full flex-1 container p-4 sm:p-6">
							{children}
						</main>
					</div>
				</ThemeProvider>
			</body>
		</html>
	);
}
