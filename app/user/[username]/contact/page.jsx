import { ContactPage } from "../../_components/contact-page";
import { getExistingUser } from "../../_lib/get-existing-user";

export default async function UserContactPage({ params }) {
	const { username } = await params;
	const user = await getExistingUser(username);

	return <ContactPage username={username} isCustomUser user={user} />;
}
