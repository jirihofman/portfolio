const revalidate = 60;

// TODO: Implement option to switch between info for authenticated user and other users.
export async function getUser(username) {
	const res = await fetch('https://api.github.com/users/' + username, {
		headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
		next: { revalidate }
	});
	return res.json();
}

export async function getRepos(username) {
	const res = await fetch('https://api.github.com/users/' + username + '/repos', {
		headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
		next: { revalidate }
	});
	return res.json();
}

export async function getSocialAccounts(username) {
	const res = await fetch('https://api.github.com/users/' + username + '/social_accounts', {
		headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
		next: { revalidate }
	});
	return res.json();
}
