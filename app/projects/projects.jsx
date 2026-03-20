import { Card } from "../components/card";
import { Article } from "./article";
import chunk from 'lodash/chunk';
import { getProjectsPageData } from "../data";

export default async function ProjectsComponent({ username }) {
	const { heroes, sorted } = await getProjectsPageData(username);

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
