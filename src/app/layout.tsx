import { NavigationBar } from "@/components/navigation-bar";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<title>torrent-stream.</title>
			</head>
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
