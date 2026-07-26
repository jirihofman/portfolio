import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import data from "../../../data.json";
import LoadingIndicator from "../../components/loading-indicator";
import { ProfileOrganizations } from "../../components/orgs";
import {
	CopilotActivity,
	RecentActivity,
} from "../../components/recent-activity";
import { getUser } from "../../data";
import { createUserPath } from "../_lib/username";

const navigation = [
	{ name: "Projects", suffix: "/projects" },
	{ name: "Contact", suffix: "/contact" },
];

async function UserIcon({ promise, fallbackName, fallbackAvatar }) {
	const user = await promise;

	return (
		<Image
			alt={`${user.name || fallbackName}'s GitHub avatar`}
			width={100}
			height={100}
			src={user.avatar_url || fallbackAvatar}
			className="float-right rounded-full mx-4"
		/>
	);
}

async function UserText({ promise, fallbackName }) {
	const user = await promise;

	return (
		<p>
			Hi, my name is {user.name || fallbackName}
			{". "}
			{user.bio}
		</p>
	);
}

function ProfileSwitcher({ username, isCustomUser }) {
	return (
		<Link
			href={isCustomUser ? "/" : "/search"}
			className="text-lg duration-500 text-zinc-500 hover:text-zinc-300 border-dashed p-2 rounded-sm border-2 border-zinc-500 hover:border-zinc-300"
		>
			{isCustomUser
				? `Showing: ${username}, click to cancel ❌`
				: "Try yourself"}
		</Link>
	);
}

export function LandingPage({ username, isCustomUser = false, user }) {
	const userPromise = user ? Promise.resolve(user) : getUser(username);
	const userPath = isCustomUser ? createUserPath(username) : null;
	const fallbackName = isCustomUser ? username : data.displayName;
	const fallbackAvatar = isCustomUser
		? `https://github.com/${encodeURIComponent(username)}.png`
		: data.avatarUrl;

	return (
		<div className="flex flex-col items-center justify-center w-screen min-h-screen overflow-y-auto bg-linear-to-tl from-black via-zinc-600/20 to-black">
			<nav className="my-16 animate-fade-in">
				<ul className="flex items-center justify-center gap-4">
					{navigation.map((item) => (
						<Link
							key={item.suffix}
							href={
								userPath
									? `${userPath}${item.suffix}`
									: item.suffix
							}
							className="text-lg duration-500 text-zinc-500 hover:text-zinc-300"
						>
							<span className="inline-flex items-center">
								{item.name} <LoadingIndicator />
							</span>
						</Link>
					))}
					<ProfileSwitcher
						username={username}
						isCustomUser={isCustomUser}
					/>
				</ul>
			</nav>
			<div className="hidden w-screen h-px animate-glow md:block animate-fade-left bg-linear-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0" />

			<h1 className="flex items-center z-10 text-4xl hover:scale-110 text-transparent duration-1000 cursor-default text-edge-outline animate-title font-display sm:text-6xl md:text-9xl whitespace-nowrap bg-clip-text bg-white p-5">
				{username}
				<Suspense fallback={null}>
					<UserIcon
						promise={userPromise}
						fallbackName={fallbackName}
						fallbackAvatar={fallbackAvatar}
					/>
				</Suspense>
			</h1>

			<div className="hidden w-screen h-px animate-glow md:block animate-fade-right bg-linear-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0" />
			<div className="my-16 text-center animate-fade-in text-lg text-zinc-500">
				<div className="w-full min-h-28">
					<Suspense fallback={<p>Loading profile...</p>}>
						<UserText
							promise={userPromise}
							fallbackName={fallbackName}
						/>
					</Suspense>
					<Suspense fallback={null}>
						<ProfileOrganizations username={username} />
					</Suspense>
					<Suspense fallback={null}>
						<RecentActivity username={username} />
					</Suspense>
					<Suspense fallback={null}>
						<CopilotActivity username={username} />
					</Suspense>
				</div>
			</div>
		</div>
	);
}
