import { notFound } from "next/navigation";
import { getUser } from "../../data";
import { isValidGitHubUsername } from "./username";

export async function getExistingUser(username) {
	if (!isValidGitHubUsername(username)) {
		notFound();
	}

	const user = await getUser(username);

	if (!user?.id) {
		notFound();
	}

	return user;
}
