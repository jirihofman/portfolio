import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import { GoStar } from "react-icons/go";
import {
	ProjectMetrics,
	ProjectTechnology,
} from "./project-secondary-info";

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact" });

export function Article({ project, loadSecondaryData = false }) {
	const appLink = project.homepage || project.html_url;
	const repositoryKey =
		project.full_name || `${project.owner.login}/${project.name}`;
	const createdAt = new Date(project.created_at).toISOString();

	return (
		<article className="p-4">
			<div className="flex items-center justify-between gap-2">
				<time
					dateTime={createdAt}
					title="Created"
					className="text-xs text-zinc-200 drop-shadow-orange duration-1000 group-hover:text-white group-hover:border-zinc-200"
				>
					{createdAt.substring(0, 10)}
				</time>
				<span className="flex items-center gap-1 text-xs text-zinc-500">
					{loadSecondaryData ? (
						<ProjectTechnology repositoryKey={repositoryKey} />
					) : null}
					<span
						title="Total stars."
						className="flex items-center gap-1"
					>
						<GoStar className="size-4" />
						{compactNumber.format(project.stargazers_count)}
					</span>
				</span>
			</div>

			<Link href={appLink}>
				<h2
					className="z-20 cursor-pointer font-display text-xl font-medium text-zinc-200 duration-1000 group-hover:text-white lg:text-3xl"
					title={`Click to view the ${project.homepage ? "app" : "repo"}.`}
				>
					<span className="bg-linear-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent hover:from-pink-500 hover:to-yellow-500">
						{project.name}
					</span>
				</h2>
			</Link>
			<div className="z-20 mt-4 text-sm text-zinc-400 duration-1000 group-hover:text-zinc-200">
				{project.description}
			</div>

			<div className="mt-2 flex items-center justify-between gap-2 border-t-2 border-gray-700 border-opacity-50">
				{loadSecondaryData ? (
					<ProjectMetrics repositoryKey={repositoryKey} />
				) : (
					<span />
				)}
				<span
					className="flex min-w-0 max-w-[38%] items-center gap-1 text-xs text-zinc-500"
					title="GitHub repository link."
				>
					<FaGithub className="size-4 shrink-0" />
					<Link
						href={project.html_url}
						className="truncate hover:text-blue-800"
					>
						{project.name}
					</Link>
				</span>
			</div>
		</article>
	);
}
