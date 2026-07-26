import Link from "next/link";
import { GoArrowLeft } from "react-icons/go";
import UserSearch from "../../components/search-input";
import { createUserPath } from "../_lib/username";

export function SearchPage({ initialUsername = "", isCustomUser = false }) {
	const backHref = isCustomUser
		? createUserPath(initialUsername) || "/"
		: "/";

	return (
		<div className="flex flex-col items-center w-screen h-screen overflow-hidden bg-linear-to-tl from-black via-zinc-600/20 to-black">
			<div className="container flex flex-row-reverse items-center justify-between p-6 mx-auto">
				<div className="flex justify-between gap-8 text-base" />

				<Link
					href={backHref}
					className="duration-200 text-zinc-300 hover:text-zinc-100"
					aria-label="Back"
				>
					<GoArrowLeft className="w-6 h-6" />
				</Link>
			</div>
			<nav className="my-16 animate-fade-in" />
			<div className="hidden w-screen h-px animate-glow md:block animate-fade-left bg-linear-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0" />

			<h1 className="sr-only">GitHub profile search</h1>
			<UserSearch user={initialUsername} />

			<div className="hidden w-screen h-px animate-glow md:block animate-fade-right bg-linear-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0" />
		</div>
	);
}
