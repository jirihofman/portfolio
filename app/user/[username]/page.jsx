import { LandingPage } from "../_components/landing-page";
import { getExistingUser } from "../_lib/get-existing-user";

export default async function UserPage({ params }) {
	const { username } = await params;
	const user = await getExistingUser(username);

	return <LandingPage username={username} isCustomUser user={user} />;
}
