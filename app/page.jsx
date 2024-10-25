import Link from "next/link";
import Image from "next/image";
import React, { Suspense } from "react";
import data from "../data.json";
import { ProfileOrganizations } from "./components/orgs";
import { RecentActivity } from "./components/recent-activity";
import { getUser } from "./data";

const navigation = [
	{ name: "Projects", href: "/projects" },
	{ name: "Contact", href: "/contact" },
];

export default async function Home(props) {
    const searchParams = await props.searchParams;

    return (
		<LandingComponent searchParams={searchParams} />
	)
}

const UserIcon = async ({ promise }) => {

	const user = await promise;

	return (
		<Image alt='👨‍💻' width={100} height={100} src={user.avatar_url || data.avatarUrl} className="float-right rounded-full mx-4" />
	);
};

const UserText = async ({ promise }) => {

	const user = await promise;

	return (
		<p>Hi, my name is {user.name || data.displayName}{'. '}{user.bio}</p>
	);
};

const TryYourself = ({ customUsername }) => {

	const href = customUsername ? '/' : '/search';

	return <Link
		href={href}
		className="text-lg duration-500 text-zinc-500 hover:text-zinc-300 border-dashed p-2 rounded border-2 border-zinc-500 hover:border-zinc-300"
	>
		{
			customUsername ? 'Showing: ' + customUsername + ', click to cancel ❌' : 'Try yourself'
		}
	</Link>;
};

const LandingComponent = async ({ searchParams: { customUsername } }) => {

	const username = customUsername || process.env.GITHUB_USERNAME || data.githubUsername;
	const promise = getUser(username);

	return (
		<div className="flex flex-col items-center justify-center w-screen h-screen overflow-hidden bg-gradient-to-tl from-black via-zinc-600/20 to-black">
			<nav className="my-16 animate-fade-in">
				<ul className="flex items-center justify-center gap-4">
					{navigation.map((item) => (
						<Link
							key={item.href}
							href={item.href + (customUsername ? `?customUsername=${customUsername}` : '')}
							className="text-lg duration-500 text-zinc-500 hover:text-zinc-300"
						>
							{item.name}
						</Link>
					))}
					<TryYourself customUsername={customUsername} />
				</ul>
			</nav>
			<div className="hidden w-screen h-px animate-glow md:block animate-fade-left bg-gradient-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0" />

			<h1 className="flex items-center z-10 text-4xl hover:scale-110 text-transparent duration-1000 cursor-default text-edge-outline animate-title font-display sm:text-6xl md:text-9xl whitespace-nowrap bg-clip-text bg-white p-5">
				{username}
				<Suspense fallback={<p>Loading...</p>}>
					<UserIcon promise={promise} />
				</Suspense>
			</h1>

			<div className="hidden w-screen h-px animate-glow md:block animate-fade-right bg-gradient-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0" />
			<div className="my-16 text-center animate-fade-in">
				<h2 className="text-lg text-zinc-500">
					<Suspense fallback={<div className="w-full h-px min-h-28">Loading...</div>}>
						<div className="w-full h-px min-h-28">
							<UserText promise={promise} />
							<ProfileOrganizations username={username} />
							<RecentActivity username={username} />
						</div>
					</Suspense>
				</h2>
			</div>
		</div>
	);
}
