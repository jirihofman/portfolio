import { Card } from "../components/card";
import { getProjectsPageData } from "../data";
import { Article } from "./article";
import { SecondaryDataProvider } from "./secondary-data-provider";

function chunkItems(items, size) {
	return Array.from(
		{ length: Math.ceil(items.length / size) },
		(_, index) => items.slice(index * size, (index + 1) * size),
	);
}

function ProjectCard({ project, loadSecondaryData }) {
	return (
		<Card>
			<Article
				project={project}
				loadSecondaryData={loadSecondaryData}
			/>
		</Card>
	);
}

export default async function ProjectsComponent({ username }) {
	const {
		heroes,
		sorted,
		isPortfolioOwner,
	} = await getProjectsPageData(username);
	const heroColumnSize = Math.max(1, Math.ceil(heroes.length / 2));
	const sortedColumnSize = Math.max(1, Math.ceil(sorted.length / 3));
	const heroColumns = chunkItems(heroes, heroColumnSize);
	const sortedColumns = chunkItems(sorted, sortedColumnSize);
	const projectGrid = (
		<>
			{heroes.length > 0 ? (
				<>
					<div className="h-px w-full bg-zinc-800" />
					<div className="mx-auto grid grid-cols-1 gap-8 lg:grid-cols-2">
						{heroColumns.map((column, columnIndex) => (
							<div
								key={`hero-column-${columnIndex}`}
								className="grid grid-cols-1 gap-4"
							>
								{column.map((project) => (
									<ProjectCard
										key={project.full_name}
										project={project}
										loadSecondaryData={isPortfolioOwner}
									/>
								))}
							</div>
						))}
					</div>
					<div className="hidden h-px w-full bg-zinc-800 md:block" />
				</>
			) : null}

			{sorted.length > 0 ? (
				<div className="mx-auto grid grid-cols-1 gap-4 md:grid-cols-3 lg:mx-0">
					{sortedColumns.map((column, columnIndex) => (
						<div
							key={`project-column-${columnIndex}`}
							className="grid grid-cols-1 gap-4"
						>
							{column.map((project) => (
								<ProjectCard
									key={project.full_name}
									project={project}
									loadSecondaryData={isPortfolioOwner}
								/>
							))}
						</div>
					))}
				</div>
			) : null}
		</>
	);

	return isPortfolioOwner ? (
		<SecondaryDataProvider>{projectGrid}</SecondaryDataProvider>
	) : (
		projectGrid
	);
}
