import { ProjectsPage } from "../../_components/projects-page";
import { getExistingUser } from "../../_lib/get-existing-user";

export default async function UserProjectsPage({ params }) {
	const { username } = await params;
	await getExistingUser(username);

	return <ProjectsPage username={username} isCustomUser />;
}
