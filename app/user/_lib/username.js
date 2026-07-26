const GITHUB_USERNAME_PATTERN =
	/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export function isValidGitHubUsername(username) {
	return (
		typeof username === "string" &&
		GITHUB_USERNAME_PATTERN.test(username)
	);
}

export function createUserPath(username) {
	if (!isValidGitHubUsername(username)) {
		return null;
	}

	return `/user/${encodeURIComponent(username)}`;
}
