import React from "react";
import { Navigation } from "../components/nav";
import { Card } from "../components/card";
import { Article } from "./article";
// import { Redis } from "@upstash/redis";

// const redis = Redis.fromEnv();

export const revalidate = 60;
export default async function ProjectsPage() {

	const response = await fetch('https://api.github.com/users/jirihofman/repos', {
		headers: {
			Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
		},
	});
	const repositories = await response.json();
	const blackList = ['lerna-poc', 'rmc2jhf', 'jirihofman'];
	const big4names = ["nextjs-fullstack-app-template", "strawberry-scim", "random8", "dali-jsme-jidlo"];
	const big4 = repositories.filter((project) => big4names.includes(project.name));
	const sorted = repositories
		.filter((p) => !p.private)
		.filter((p) => !p.fork)
		.filter((p) => !big4names.includes(p.name))
		.filter((p) => !blackList.includes(p.name))
		.sort(
			(a, b) =>
				new Date(b.stargazers_count ?? Number.POSITIVE_INFINITY).getTime() -
				new Date(a.stargazers_count ?? Number.POSITIVE_INFINITY).getTime(),
		)
		.sort(
			(a, b) =>
				new Date(b.date ?? Number.POSITIVE_INFINITY).getTime() -
				new Date(a.date ?? Number.POSITIVE_INFINITY).getTime(),
		);

	return (
		<div className="relative pb-16">
			<Navigation />
			<div className="px-6 pt-16 mx-auto space-y-8 max-w-7xl lg:px-8 md:space-y-16 md:pt-24 lg:pt-32">
				<div className="max-w-2xl mx-auto lg:mx-0">
					<h2 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
						Projects
					</h2>
					<p className="mt-4 text-zinc-400">
					 My hobby projects, most of them are Nextjs apps deployed to Vercel.
					</p>
				</div>
				<div className="w-full h-px bg-zinc-800" />

				<div className="grid grid-cols-1 gap-8 mx-auto lg:grid-cols-2 ">

					<div className="grid grid-cols-1 gap-4">
						{[big4[2], big4[0	]].map((project) => (
							<Card key={project.name}>
								<Article project={project} />
							</Card>
						))}
					</div>
					<div className="grid grid-cols-1 gap-4">
						{[big4[1], big4[3]].map((project) => (
							<Card key={project.name}>
								<Article project={project} />
							</Card>
						))}
					</div>
				</div>
				<div className="hidden w-full h-px md:block bg-zinc-800" />

				<div className="grid grid-cols-1 gap-4 mx-auto lg:mx-0 md:grid-cols-3">
					<div className="grid grid-cols-1 gap-4">
						{sorted
							.filter((_, i) => i % 3 === 0)
							.map((project) => (
								<Card key={project.name}>
									<Article project={project} />
								</Card>
							))}
					</div>
					<div className="grid grid-cols-1 gap-4">
						{sorted
							.filter((_, i) => i % 3 === 1)
							.map((project) => (
								<Card key={project.name}>
									<Article project={project} />
								</Card>
							))}
					</div>
					<div className="grid grid-cols-1 gap-4">
						{sorted
							.filter((_, i) => i % 3 === 2)
							.map((project) => (
								<Card key={project.name}>
									<Article project={project} />
								</Card>
							))}
					</div>
				</div>
			</div>
		</div>
	);
}
