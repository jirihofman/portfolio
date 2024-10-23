import { unstable_cache } from 'next/cache';

const revalidate = 60;
const MINUTES_5 = 60 * 5;
const HOURS_1 = 60 * 60;
const HOURS_12 = 60 * 60 * 12;

// TODO: Implement option to switch between info for authenticated user and other users.
export async function getUser(username) {
    console.log('Fetching user data for', username);
    console.time('getUser');
    const res = await fetch('https://api.github.com/users/' + username, {
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        next: { revalidate }
    });
    console.timeEnd('getUser');
    return res.json();
}

export async function getRepos(username) {
    console.log('Fetching repos for', username);
    console.time('getRepos');
    const res = await fetch('https://api.github.com/users/' + username + '/repos', {
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        next: { revalidate: HOURS_1 }
    });
    if (!res.ok) {
        console.error('GitHub API returned an error.', res.status, res.statusText);
        return [];
    }
    console.timeEnd('getRepos');
    return res.json();
}

export async function getSocialAccounts(username) {
    console.log('Fetching social accounts for', username);
    console.time('getSocialAccounts');
    const res = await fetch('https://api.github.com/users/' + username + '/social_accounts', {
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        next: { revalidate: HOURS_12 }
    });
    console.timeEnd('getSocialAccounts');
    return res.json();
}

export const getPinnedRepos = unstable_cache(async (username) => {
    console.log('Fetching pinned repos for', username);
    console.time('getPinnedRepos');
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        body: JSON.stringify({ query: `{user(login: "${username}") {pinnedItems(first: 6, types: REPOSITORY) {nodes {... on Repository {name}}}}}` }),
    });
    if (!res.ok) {
        console.error('GitHub graphql returned an error.', res.status, res.statusText);
        return [];
    }
    const pinned = await res.json();
    console.timeEnd('getPinnedRepos');
    const names = pinned.data.user.pinnedItems.nodes.map((node) => node.name);
    return names;
}, ['getPinnedRepos'], { revalidate: HOURS_12 });

export const getUserOrganizations = unstable_cache(async (username) => {
    console.log('Fetching organizations for', username);
    console.time('getUserOrganizations');
    const res = await fetch('https://api.github.com/graphql', {
        next: { MINUTES_5 },
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        body: JSON.stringify({
            query: `{user(login: "${username}") {organizations(first: 6) {nodes {name,websiteUrl,url,avatarUrl,description}}}}`
        }),
    });
    console.timeEnd('getUserOrganizations');
    const orgs = await res.json();

    if (!res.ok) {
        console.error('GitHub graphql returned an error.', res.status, res.statusText, orgs);
        return { data: { user: { organizations: { nodes: [] } } } };
    }
    return orgs;
}, ['getUserOrganizations'], { revalidate: HOURS_12 });

export const getVercelProjects = async () => {
    if (!process.env.VC_TOKEN) {
        console.log('No Vercel token found - no projects will be shown.');
        return { projects: [] };
    }
    console.log('Fetching Vercel projects');
    console.time('getVercelProjects');
    const res = await fetch('https://api.vercel.com/v9/projects', {
        headers: { Authorization: `Bearer ${process.env.VC_TOKEN}` },
        next: { revalidate: HOURS_12 }
    });
    console.timeEnd('getVercelProjects');
    // eg. expired token.
    if (!res.ok) {
        console.error('Vercel API returned an error.', res.status, res.statusText);
        return { projects: [] };
    }
    return res.json();
};

/** Cache revalidated every 12 hours. */
export const getNextjsLatestRelease = unstable_cache(async () => {
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        next: { revalidate: HOURS_12 },
        body: JSON.stringify({
            query: `{
                repository(name: "next.js", owner: "vercel") {
                    latestRelease {
                        tagName
                        updatedAt
                    }
                }
            }`
        }),
    });
    if (!res.ok) {
        console.error('GitHub API returned an error.', res.status, res.statusText);
        return {};
    }
    const nextjsLatest = await res.json();

    const result = {
        tagName: nextjsLatest.data.repository.latestRelease.tagName.replace('v', ''),
        updatedAt: nextjsLatest.data.repository.latestRelease.updatedAt,
    }
    return result;
}, ['getNextjsLatestRelease'], { revalidate: HOURS_1 });

export const getRepositoryPackageJson = unstable_cache(async (username, reponame) => {
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        body: JSON.stringify({
            query: `{
                repository(name: "${reponame}", owner: "${username}") {
                    object(expression: "HEAD:package.json") {
                        ... on Blob {
                            text
                        }
                    }
                }
            }`
        }),
    });
    const response = await res.json();
    try {
        const packageJson = JSON.parse(response.data.repository.object.text);
        return packageJson;
    } catch (error) {
        console.error('Error parsing package.json', error);
        return {};
    }
}, ['getRepositoryPackageJson'], { revalidate: HOURS_1 });

export const getRecentUserActivity = async (username) => {
    console.log('Fetching recent activity for', username);
    console.time('getRecentUserActivity');
    const res = await fetch('https://api.github.com/users/' + username + '/events?per_page=100', {
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        next: { revalidate: MINUTES_5 }
    });
    const response = await res.json();
    // Check pagination
    if (res.headers.get('link')) {
        let page = 2;
        let nextLink = res.headers.get('link').split(',').find((link) => link.includes('rel="next"'));
        while (nextLink) {
            const nextRes = await fetch('https://api.github.com/users/' + username + '/events?per_page=100&page=' + page, {
                headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
                next: { revalidate: MINUTES_5 }
            });
            const nextResponse = await nextRes.json();
            response.push(...nextResponse);
            nextLink = nextRes.headers.get('link').split(',').find((link) => link.includes('rel="next"'));
            page++;
        };
    }

    if (!res.ok) {
        console.error('GitHub API /users returned an error.', res.status, res.statusText, response);
        return [];
    }
    console.timeEnd('getRecentUserActivity');
    return response;
};

export const getTrafficPageViews = async (username, reponame) => {
    const res = await fetch('https://api.github.com/repos/' + username + '/' + reponame + '/traffic/views', {
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        next: { revalidate: HOURS_1 }
    });
    const response = await res.json();

    const sumUniques = response.uniques || 0;

    // Today date in format YYYY-MM-DD.
    const today = new Date().toISOString().slice(0, 10);
    // Last day with at least one view.
    const todayUniques = response.views?.find((day) => day.timestamp.startsWith(today))?.uniques || 0;

    return { sumUniques, todayUniques };
};

export const getDependabotAlerts = unstable_cache(async (username, reponame) => {
    const res = await fetch('https://api.github.com/repos/' + username + '/' + reponame + '/dependabot/alerts', {
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        next: { revalidate: HOURS_12 }
    });

    const response = await res.json();

    // Id dependabot is not enabled, the response will be an object, not an array.
    if (response.length === undefined) {
        return [];
    }
    const openAlertsBySeverity = response.reduce((acc, alert) => {
        if (alert.state === 'open') {
            acc[alert.security_advisory.severity] = acc[alert.security_advisory.severity] ? acc[alert.security_advisory.severity] + 1 : 1;
        }
        return acc;
    }, {});

    return openAlertsBySeverity;
}, ['getDependabotAlerts'], { revalidate: HOURS_12 });

/**
 * Determines if a repository is using Next.js App Router or legacy pages/_app.jsx. Or both.
 * Using unstable_cache because fetch calls are not cached when failing. This is the case when eg _app.jsx is not found.
 * @param {*} repoOwner GitHub username
 * @param {string} repoName repository name
 * @returns Object with two booleans: isRouterPages and isRouterApp
 */
export const checkAppJsxExistence = unstable_cache(async (repoOwner, repoName) => {
    const urlPagesApp = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/pages/_app.jsx`;
    // TODO: Add more possible ways to check for App Router.
    const urlAppLayout = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/app/layout.jsx`;

    const res = {
        isRouterPages: false,
        isRouterApp: false,
    };

    try {
        const [ isPagesRes, isAppLayoutRes ] = await Promise.all([
            fetch(urlPagesApp, {
                headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
                next: { revalidate: HOURS_1 }
            }),
            fetch(urlAppLayout, {
                headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
                next: { revalidate: HOURS_1 }
            }),
        ]);

        if (isPagesRes.status === 200) {
            res.isRouterPages = true;
        }

        if (isAppLayoutRes.status === 200) {
            res.isRouterApp = true;
        }
    } catch (error) {
        console.error(`Error checking _app.jsx existence in ${repoName}: ${error.message}`);
    }

    return res;
}, ['checkAppJsxExistence'], { revalidate: HOURS_1 });
