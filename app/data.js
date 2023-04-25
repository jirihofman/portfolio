const revalidate = 60;
export async function getUser(username) {
	const res = await fetch('https://api.github.com/users/' + username, {
		headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
		next: { revalidate }
	});
	return res.json();
}

export async function getRepos(username) {
	const res = await fetch('https://api.github.com/users/' + username + '/repos', {
		headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
		next: { revalidate }
	});
	return res.json();
}
