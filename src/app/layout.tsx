// import { Poppins } from "next/font/google";
import "../styles/globals.css";
import { Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";

// const poppins = Poppins({
// 	weight: ["300", "400", "500", "600", "700"],
// 	subsets: ["latin"],
// 	display: "swap",
// 	variable: "--font-poppins",
// });

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
	],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
