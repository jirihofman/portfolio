import "../global.css";
import { Inter } from "next/font/google";
import LocalFont from "next/font/local";
import React from "react";

export const metadata = {
	title: {
		default: "Jiří Hofman's portfolio",
		template: "%s | Jiří Hofman's portfolio",
	},
	description: "Software engineer at client.io",
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	icons: [
		{
			url: "/favicon.ico",
			rel: "icon",
			sizes: "any",
			type: "image/svg+xml",
		},
	]
};
const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
});

const calSans = LocalFont({
	src: "../public/fonts/CalSans-SemiBold.ttf",
	variable: "--font-calsans",
});

export default function RootLayout({
	children,
}) {
	return (
		<html lang="en" className={[inter.variable, calSans.variable].join(" ")}>
			<body
				className={`bg-black ${
					process.env.NODE_ENV === "development" ? "debug-screens" : undefined
				}`}
			>
				{/* <Analytics /> */}
				{children}
			</body>
		</html>
	);
}
