const EXTERNAL_FETCH_TIMEOUT_MS = 10_000;
const GITHUB_USERNAME_PATTERN =
	/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

const users = async (req, res) => {
	const { username } = req.query;

	if (
		typeof username !== "string" ||
		!GITHUB_USERNAME_PATTERN.test(username)
	) {
		return res.status(400).json({ error: "A valid GitHub username is required." });
	}

	const headers = { Accept: 'application/vnd.github+json' };

	if (process.env.GH_TOKEN) {
		headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
	}

	try {
		const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
			headers,
			signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
		});

		if (!response.ok) {
			return res.status(response.status).json({ error: "GitHub user not found." });
		}

		const data = await response.json();

		res.setHeader(
			"Cache-Control",
			"public, s-maxage=3600, stale-while-revalidate=86400",
		);
		return res.status(200).json({ id: data.id });
	} catch (error) {
		console.error(`GitHub user API request failed for ${username}:`, error);
		const status = error?.name === 'TimeoutError' ? 504 : 502;

		return res.status(status).json({ error: 'Unable to fetch GitHub user data.' });
	}
};

export default users;
