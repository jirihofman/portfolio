import data from "../../data.json";
import { ProjectsPage } from "../user/_components/projects-page";

const username = process.env.GITHUB_USERNAME || data.githubUsername;

export default function Projects() {
	return <ProjectsPage username={username} />;
}
