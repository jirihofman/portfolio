import { cache } from 'react';
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

export const getPinnedRepos = cache(async (username) => {
	const res = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
		body: JSON.stringify({ query: `{user(login: "${username}") {pinnedItems(first: 6, types: REPOSITORY) {nodes {... on Repository {name}}}}}` }),
	});
	const pinned = await res.json();
	const names = pinned.data.user.pinnedItems.nodes.map((node) => node.name);
	return names;
});

export const getUserOrganizations = async (username) => {
	const res = await fetch('https://api.github.com/graphql', {
		cache: 'no-store',
		method: 'POST',
		headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
		body: JSON.stringify({
			query: `{user(login: "${username}") {organizations(first: 6) {nodes {name,websiteUrl,url,avatarUrl,description}}}}` }),
	});
	return res.json();
};

export const getVercelProjects = async () => {
	if (!process.env.VC_TOKEN) {
		console.log('No Vercel token found - no projects will be shown.');
		return { projects: [] };
	}
	const res = await fetch('https://api.vercel.com/v9/projects', {
		headers: { Authorization: `Bearer ${process.env.VC_TOKEN}` },
	});
	return res.json();
};
