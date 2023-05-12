import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";
import UserSearch from "../components/search-input";

const navigation = [
	{ name: "Projects", href: "/projects" },
	{ name: "Contact", href: "/contact" },
];

export default function Home({
	searchParams: { customUsername },
}) {

	const username = customUsername || process.env.GITHUB_USERNAME;

	return (
		<div className="flex flex-col items-center  w-screen h-screen overflow-hidden bg-gradient-to-tl from-black via-zinc-600/20 to-black">
			<div className="container flex flex-row-reverse items-center justify-between p-6 mx-auto">
				<div className="flex justify-between gap-8 text-base">
				</div>

				<Link
					href={"/"}
					className="duration-200 text-zinc-300 hover:text-zinc-100"
				>
					<ArrowLeft className="w-6 h-6" />
				</Link>
			</div>
			<nav className="my-16 animate-fade-in" />
			<div className="hidden w-screen h-px animate-glow md:block animate-fade-left bg-gradient-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0" />

			<h1 className="">
				<UserSearch user={username}/>
			</h1>

			<div className="hidden w-screen h-px animate-glow md:block animate-fade-right bg-gradient-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0" />
		</div>
	);
}
