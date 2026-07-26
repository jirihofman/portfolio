import Link from "next/link";
import { Card } from "../components/card";
import { getProjectsPageData } from "../data";
import { Article } from "./article";

const DEFAULT_PROJECT_LIMIT = 6;

function chunkItems(items, size) {
	return Array.from(
		{ length: Math.ceil(items.length / size) },
		(_, index) => items.slice(index * size, (index + 1) * size),
	);
}

function ProjectCard({ project, deferRender = false }) {
	return (
		<Card deferRender={deferRender}>
			<Article project={project} />
		</Card>
	);
}

export default async function ProjectsComponent({
	username,
	showAll = false,
	projectsPath = "/projects",
}) {
	const {
		heroes,
		sorted,
		totalProjects,
	} = await getProjectsPageData(username, {
		limit: showAll ? undefined : DEFAULT_PROJECT_LIMIT,
	});
	const visibleHeroes = showAll
		? heroes
		: heroes.slice(0, DEFAULT_PROJECT_LIMIT);
	const remainingSlots = Math.max(
		0,
		DEFAULT_PROJECT_LIMIT - visibleHeroes.length,
	);
	const visibleSorted = showAll
		? sorted
		: sorted.slice(0, remainingSlots);
	const heroColumnSize = Math.max(
		1,
		Math.ceil(visibleHeroes.length / 2),
	);
	const sortedColumnSize = Math.max(
		1,
		Math.ceil(visibleSorted.length / 3),
	);
	const heroColumns = chunkItems(visibleHeroes, heroColumnSize);
	const sortedColumns = chunkItems(visibleSorted, sortedColumnSize);
	const isTruncated =
		visibleHeroes.length + visibleSorted.length < totalProjects;

	return (
		<>
			{visibleHeroes.length > 0 ? (
				<>
					<div className="w-full h-px bg-zinc-800" />
					<div className="grid grid-cols-1 gap-8 mx-auto lg:grid-cols-2">
						{heroColumns.map((column, columnIndex) => (
							<div
								key={`hero-column-${columnIndex}`}
								className="grid grid-cols-1 gap-4"
							>
								{column.map((project, projectIndex) => (
									<ProjectCard
										key={project.full_name || project.name}
										project={project}
										deferRender={
											showAll &&
											columnIndex * heroColumnSize +
												projectIndex >=
												DEFAULT_PROJECT_LIMIT
										}
									/>
								))}
							</div>
						))}
					</div>
					<div className="hidden w-full h-px md:block bg-zinc-800" />
				</>
			) : null}

			{visibleSorted.length > 0 ? (
				<div className="grid grid-cols-1 gap-4 mx-auto lg:mx-0 md:grid-cols-3">
					{sortedColumns.map((column, columnIndex) => (
						<div
							key={`project-column-${columnIndex}`}
							className="grid grid-cols-1 gap-4"
						>
							{column.map((project, projectIndex) => (
								<ProjectCard
									key={project.full_name || project.name}
									project={project}
									deferRender={
										showAll &&
										visibleHeroes.length +
											columnIndex * sortedColumnSize +
											projectIndex >=
											DEFAULT_PROJECT_LIMIT
									}
								/>
							))}
						</div>
					))}
				</div>
			) : null}

			{isTruncated ? (
				<div className="flex justify-center">
					<Link
						href={`${projectsPath}/all`}
						prefetch={false}
						className="text-lg duration-500 text-zinc-400 hover:text-zinc-100 border border-zinc-600 hover:border-zinc-400 rounded-lg px-5 py-3"
					>
						View all {totalProjects} projects
					</Link>
				</div>
			) : showAll && totalProjects > DEFAULT_PROJECT_LIMIT ? (
				<div className="flex justify-center">
					<Link
						href={projectsPath}
						className="text-lg duration-500 text-zinc-400 hover:text-zinc-100"
					>
						Show fewer projects
					</Link>
				</div>
			) : null}
		</>
	);
}
