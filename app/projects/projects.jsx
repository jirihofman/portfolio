import { Card } from "../components/card";
// import { UserTimeline } from "../components/timeline";
import { Article } from "./article";
import data from "../../data.json";
import chunk from 'lodash/chunk';
import { getRepos, getPinnedRepos, getVercelProjects } from "../data";

export default async function ProjectsComponent({ username }) {

	const [
		repositories,
		pinnedNames,
		vercelProjects
	] = await Promise.all([
		getRepos(username),
		getPinnedRepos(username),
		getVercelProjects()
	]);

	// interested only in the project name, link, framework and description
	// interested only in Vercel projects that are linked to GitHub repositories
	const vercelProjectsDetails = vercelProjects.projects
		.filter(project => {
			const githubRepo = repositories.find(repo => repo.name === project.name);
			return githubRepo;
		})
		.map((project) => ({
			framework: project.framework,
			name: project.name,
			nodeVersion: project.nodeVersion,
			link: project.link,
			description: project.description,
		}));

	// For Vercel projects, add the framework to the GitHub repository info object.
	repositories.forEach(repo => {
		const vercelRepo = vercelProjectsDetails.find(vercelRepo => vercelRepo.name === repo.name);
		if (vercelRepo) {
			repo.vercel = vercelRepo;
		}
	});

	// const heroes = repositories.filter((project) => data.projects.heroNames.includes(project.name)).sort((a, b) => b.stargazers_count - a.stargazers_count);
	const heroes = repositories.filter((project) => pinnedNames.includes(project.name)).sort((a, b) => b.stargazers_count - a.stargazers_count);
	const sorted = repositories
		.filter((p) => !p.private)
		.filter((p) => !p.fork)
		.filter((p) => !p.archived)
		// .filter((p) => p.name !== username)
		.filter((p) => !pinnedNames.includes(p.name))
		.filter((p) => !data.projects.blacklist.includes(p.name))
		.sort(
			(a, b) =>
				new Date(b.updated_at ?? Number.POSITIVE_INFINITY).getTime() -
				new Date(a.updated_at ?? Number.POSITIVE_INFINITY).getTime(),
		);

	const chunkSize = Math.ceil(sorted.length / 3);
	return (
		<>
				{
					heroes.length ? <>
						<div className="w-full h-px bg-zinc-800" />
						<div className="grid grid-cols-1 gap-8 mx-auto lg:grid-cols-2 ">

							{
								(heroes[0] || heroes[2]) ?
									<div className="grid grid-cols-1 gap-4">
										{[heroes[0], heroes[2]].map((project) => (
											!project ? null :
												<Card key={project.name}>
													<Article project={project} />
												</Card>
										))}
									</div> : null
							}
							{
								(heroes[1] || heroes[3]) ?
									<div className="grid grid-cols-1 gap-4">
										{[heroes[1], heroes[3]].map((project) => (
											!project ? null :
												<Card key={project.name}>
													<Article project={project} />
												</Card>
										))}
									</div> : null
							}
						</div>
						<div className="hidden w-full h-px md:block bg-zinc-800" />
					</> : null
				}

				<div className="grid grid-cols-1 gap-4 mx-auto lg:mx-0 md:grid-cols-3">
					<div className="grid grid-cols-1 gap-4">
						{chunk(sorted, chunkSize)[0]?.map((project) => (
							<Card key={project.name}>
								<Article project={project} />
							</Card>
						))}
					</div>
					<div className="grid grid-cols-1 gap-4">
						{chunk(sorted, chunkSize)[1]?.map((project) => (
							<Card key={project.name}>
								<Article project={project} />
							</Card>
						))}
					</div>
					<div className="grid grid-cols-1 gap-4">
						{chunk(sorted, chunkSize)[2]?.map((project) => (
							<Card key={project.name}>
								<Article project={project} />
							</Card>
						))}
					</div>
				</div>
		</>
	);
}
