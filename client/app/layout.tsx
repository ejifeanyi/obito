import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
// import Providers from "./providers/Providers";

const manrope = Manrope({
	variable: "--manrope",
	subsets: ["latin"],
});


export const metadata: Metadata = {
	title: "shiroe",
	description:
	"Obito is a real-time, AI-powered finance app that helps groups and families manage shared expenses, split bills, and track budgets together with Stripe-powered payments.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${manrope.variable} font-sans antialiased`}>
				{/* <Providers>{children}</Providers> */}
        {children}
			</body>
		</html>
	);
}
