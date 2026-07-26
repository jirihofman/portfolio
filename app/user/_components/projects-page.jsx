import { Suspense } from "react";
import data from "../../../data.json";
import { Navigation } from "../../components/nav";
import ProjectsComponent from "../../projects/projects";
import { createUserPath } from "../_lib/username";

export function ProjectsPage({
	username,
	isCustomUser = false,
	showAll = false,
}) {
	const userPath = isCustomUser ? createUserPath(username) : null;
	const projectsPath = userPath ? `${userPath}/projects` : "/projects";

	return (
		<div className="relative pb-16 pt-4">
			<Navigation username={isCustomUser ? username : undefined} />
			<div className="px-6 pt-16 mx-auto space-y-8 max-w-7xl lg:px-8 md:space-y-12 md:pt-24 lg:pt-32">
				<div className="max-w-2xl mx-auto lg:mx-0">
					<h2 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
						{showAll ? "All projects" : "Projects"}
					</h2>
					<p className="mt-4 text-zinc-400">
						{isCustomUser
							? `${username}'s projects`
							: data.description}
					</p>
				</div>

				<Suspense
					fallback={
						<div className="text-lg text-zinc-500">Loading...</div>
					}
				>
					<ProjectsComponent
						username={username}
						showAll={showAll}
						projectsPath={projectsPath}
					/>
				</Suspense>
			</div>
		</div>
	);
}
