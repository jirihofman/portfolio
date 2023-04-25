import React from "react";
import { Navigation } from "../components/nav";
import { Card } from "../components/card";
import { Article } from "./article";
import chunk from 'lodash/chunk';
import data from "../../data.json";
import { getRepos, getUser } from "../data";
// import { Redis } from "@upstash/redis";

// const redis = Redis.fromEnv();

export default async function ProjectsPage() {
	
	// Initiate both requests in parallel
	const userData = getUser(data.githubUsername);
	const reposData = getRepos(data.githubUsername);

	// Wait for the promises to resolve
	const [user, repositories] = await Promise.all([userData, reposData]);

	const big4 = repositories.filter((project) => data.projects.big4names.includes(project.name));
	const sorted = repositories
		.filter((p) => !p.private)
		.filter((p) => !p.fork)
		.filter((p) => !data.projects.big4names.includes(p.name))
		.filter((p) => !data.projects.blacklist.includes(p.name))
		.sort(
			(a, b) =>
				new Date(b.updated_at ?? Number.POSITIVE_INFINITY).getTime() -
				new Date(a.updated_at ?? Number.POSITIVE_INFINITY).getTime(),
		);

	const chunkSize = Math.ceil(sorted.length / 3);
	return (
		<div className="relative pb-16">
			<Navigation />
			<div className="px-6 pt-16 mx-auto space-y-8 max-w-7xl lg:px-8 md:space-y-16 md:pt-24 lg:pt-32">
				<div className="max-w-2xl mx-auto lg:mx-0">
					<h2 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
						Projects
					</h2>
					<p className="mt-4 text-zinc-400">
						{data.description}
					</p>
				</div>

				{
					big4.length ? <>
						<div className="w-full h-px bg-zinc-800" />
						<div className="grid grid-cols-1 gap-8 mx-auto lg:grid-cols-2 ">

							<div className="grid grid-cols-1 gap-4">
								{[big4[2], big4[0]].map((project) => (
									!project ? null :
										<Card key={project.name}>
											<Article project={project} />
										</Card>
								))}
							</div>
							<div className="grid grid-cols-1 gap-4">
								{[big4[1], big4[3]].map((project) => (
									!project ? null :
										<Card key={project.name}>
											<Article project={project} />
										</Card>
								))}
							</div>
						</div>
						<div className="hidden w-full h-px md:block bg-zinc-800" />
					</> : null
				}

				<div className="grid grid-cols-1 gap-4 mx-auto lg:mx-0 md:grid-cols-3">
					<div className="grid grid-cols-1 gap-4">
						{chunk(sorted, chunkSize)[0]
							.map((project) => (
								<Card key={project.name}>
									<Article project={project} />
								</Card>
							))}
					</div>
					<div className="grid grid-cols-1 gap-4">
						{chunk(sorted, chunkSize)[1]
							.map((project) => (
								<Card key={project.name}>
									<Article project={project} />
								</Card>
							))}
					</div>
					<div className="grid grid-cols-1 gap-4">
						{chunk(sorted, chunkSize)[2]
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
