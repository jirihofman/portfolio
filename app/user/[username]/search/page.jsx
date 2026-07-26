import { SearchPage } from "../../_components/search-page";
import { getExistingUser } from "../../_lib/get-existing-user";

export default async function UserSearchPage({ params }) {
	const { username } = await params;
	await getExistingUser(username);

	return <SearchPage initialUsername={username} isCustomUser />;
}
