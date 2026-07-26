import data from "../../../data.json";
import { ProjectsPage } from "../../user/_components/projects-page";

const username = process.env.GITHUB_USERNAME || data.githubUsername;

export default function AllProjectsPage() {
	return <ProjectsPage username={username} showAll />;
}
