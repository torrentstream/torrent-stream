import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import { NavigationBar } from "@/components/navigation-bar";

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
					<div className="min-h-screen h-0 flex flex-col">
						<NavigationBar />
						<main className="mx-auto flex-1 container p-6">{children}</main>
					</div>
				</ThemeProvider>
			</body>
		</html>
	);
}
