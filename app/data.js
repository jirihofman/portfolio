// Using unstable_cache for data fetching functions to improve performance.
// These wrappers provide automatic caching with configurable revalidation times.
import { unstable_cache } from 'next/cache';
import data from '../data.json';

const revalidate = 60;
const MINUTES_5 = 60 * 5;
const HOURS_1 = 60 * 60;
const HOURS_12 = 60 * 60 * 12;
const HOURS_24 = 60 * 60 * 24;
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_GRAPHQL_URL = `${GITHUB_API_URL}/graphql`;

function cloneFallbackValue(fallback) {
    if (fallback === null || fallback === undefined || typeof fallback !== 'object') {
        return fallback;
    }

    return structuredClone(fallback);
}

function getGitHubHeaders(extraHeaders = {}) {
    const headers = {
        Accept: 'application/vnd.github+json',
        ...extraHeaders,
    };

    if (process.env.GH_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
    }

    return headers;
}

async function parseJsonResponse(res, context, fallback) {
    try {
        return await res.json();
    } catch (error) {
        console.error(`Failed to parse JSON for ${context}:`, error);
        return cloneFallbackValue(fallback);
    }
}

async function fetchGitHubResponse(url, { context, fallback = null, method = 'GET', body, headers, next } = {}) {
    try {
        const res = await fetch(url, {
            method,
            body,
            headers: getGitHubHeaders(headers),
            next,
        });
        const contentType = res.headers.get('content-type') || '';
        let payload = cloneFallbackValue(fallback);

        if (contentType.includes('application/json')) {
            payload = await parseJsonResponse(res, context, fallback);
        } else if (res.ok) {
            console.error(`GitHub API returned a non-JSON response for ${context}.`);
        }

        if (!res.ok) {
            console.error(`GitHub API returned an error for ${context}.`, res.status, res.statusText);
            return { ok: false, data: cloneFallbackValue(fallback), headers: res.headers };
        }

        return { ok: true, data: payload, headers: res.headers };
    } catch (error) {
        console.error(`GitHub API request failed for ${context}:`, error);
        return { ok: false, data: cloneFallbackValue(fallback), headers: new Headers() };
    }
}

async function fetchGitHubJson(url, options) {
    const response = await fetchGitHubResponse(url, options);
    return response.data;
}

async function fetchGitHubGraphQL(query, variables, { context, fallback = null, next } = {}) {
    const response = await fetchGitHubResponse(GITHUB_GRAPHQL_URL, {
        context,
        fallback,
        method: 'POST',
        next,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        return cloneFallbackValue(fallback);
    }

    if (response.data?.errors) {
        console.error(`GitHub GraphQL returned an error for ${context}.`, response.data.errors);
        return cloneFallbackValue(fallback);
    }

    return response.data?.data ?? cloneFallbackValue(fallback);
}

function hasNextPage(linkHeader) {
    return Boolean(linkHeader?.split(',').some((link) => link.includes('rel="next"')));
}

async function fetchPaginatedGitHubArray(initialUrl, { context, next } = {}) {
    const items = [];
    let page = 1;
    let shouldContinue = true;

    while (shouldContinue) {
        const url = new URL(initialUrl);

        if (page > 1) {
            url.searchParams.set('page', page.toString());
        }

        const response = await fetchGitHubResponse(url.toString(), {
            context: `${context} (page ${page})`,
            fallback: [],
            next,
        });

        if (!response.ok) {
            break;
        }

        if (!Array.isArray(response.data)) {
            console.error(`GitHub API returned an unexpected payload for ${context} on page ${page}.`);
            break;
        }

        items.push(...response.data);
        shouldContinue = hasNextPage(response.headers.get('link'));
        page++;
    }

    return items;
}

function getRepositoryKey(project) {
    return project.full_name ?? `${project.owner?.login}/${project.name}`;
}

function isOwnedRepository(project, username) {
    return Boolean(username && project.owner?.login && project.owner.login.toLowerCase() === username.toLowerCase());
}

function createEmptyVercelDetails(nextjsLatestRelease = {}) {
    return {
        nextjsLatestRelease,
        packageJson: null,
        isRouterPages: false,
        isRouterApp: false,
        repositoryFrameworks: [],
    };
}

function chunkItems(items, size) {
    if (!items.length) {
        return [];
    }

    const chunks = [];

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }

    return chunks;
}

// TODO: Implement option to switch between info for authenticated user and other users.
export const getUser = unstable_cache(async (username) => {
    console.log('Fetching user data for', username);
    console.time('getUser');
    const response = await fetchGitHubJson(`${GITHUB_API_URL}/users/${username}`, {
        context: `user data for ${username}`,
        fallback: {},
    });
    console.timeEnd('getUser');
    return response;
}, (username) => ['getUser', username], { revalidate });

export const getRepos = unstable_cache(async (username) => {
    console.log('Fetching repos for', username);
    console.time('getRepos');
    const response = await fetchPaginatedGitHubArray(`${GITHUB_API_URL}/users/${username}/repos?per_page=100`, {
        context: `repositories for ${username}`,
    });
    console.timeEnd('getRepos');
    return response;
}, (username) => ['getRepos', username], { revalidate: HOURS_1 });

export const getSocialAccounts = unstable_cache(async (username) => {
    console.log('Fetching social accounts for', username);
    console.time('getSocialAccounts');
    const response = await fetchGitHubJson(`${GITHUB_API_URL}/users/${username}/social_accounts`, {
        context: `social accounts for ${username}`,
        fallback: [],
    });
    console.timeEnd('getSocialAccounts');
    return Array.isArray(response) ? response : [];
}, (username) => ['getSocialAccounts', username], { revalidate: HOURS_12 });

export const getPinnedRepos = unstable_cache(async (username) => {
    console.log('Fetching pinned repos for', username);
    console.time('getPinnedRepos');
    const pinned = await fetchGitHubGraphQL(`
        query GetPinnedRepos($username: String!) {
            user(login: $username) {
                pinnedItems(first: 6, types: REPOSITORY) {
                    nodes {
                        ... on Repository {
                            name
                        }
                    }
                }
            }
        }
    `, { username }, {
        context: `pinned repositories for ${username}`,
        fallback: { user: { pinnedItems: { nodes: [] } } },
    });
    console.timeEnd('getPinnedRepos');
    return pinned.user?.pinnedItems?.nodes?.map((node) => node?.name).filter(Boolean) ?? [];
}, (username) => ['getPinnedRepos', username], { revalidate: HOURS_12 });

export const getUserOrganizations = unstable_cache(async (username) => {
    console.log('Fetching organizations for', username);
    console.time('getUserOrganizations');
    const orgs = await fetchGitHubGraphQL(`
        query GetUserOrganizations($username: String!) {
            user(login: $username) {
                organizations(first: 6) {
                    nodes {
                        name
                        websiteUrl
                        url
                        avatarUrl
                        description
                    }
                }
            }
        }
    `, { username }, {
        context: `organizations for ${username}`,
        fallback: { user: { organizations: { nodes: [] } } },
    });
    console.timeEnd('getUserOrganizations');
    return { data: orgs };
}, (username) => ['getUserOrganizations', username], { revalidate: HOURS_12 });

export const getVercelProjects = unstable_cache(async () => {
    if (!process.env.VC_TOKEN) {
        console.log('No Vercel token found - no projects will be shown.');
        return { projects: [] };
    }
    console.log('Fetching Vercel projects');
    console.time('getVercelProjects');

    const baseUrl = 'https://api.vercel.com/v9/projects';
    const limit = 100;
    let nextCursor = null;
    let url = `${baseUrl}?limit=${limit}`;
    const allProjects = [];

    try {
        do {
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${process.env.VC_TOKEN}` },
            });

            if (!res.ok) {
                console.error('Vercel API returned an error.', res.status, res.statusText);
                return { projects: [] };
            }

            let data;
            try {
                data = await res.json();
            } catch (error) {
                console.error('Failed to parse Vercel API response.', error);
                return { projects: [] };
            }

            allProjects.push(...(data.projects ?? []));
            nextCursor = data.pagination?.next || null;
            url = nextCursor ? `${baseUrl}?limit=${limit}&until=${nextCursor}` : '';
        } while (nextCursor);

        console.log('Vercel projects count:', allProjects.length);
        return { projects: allProjects };
    } catch (error) {
        console.error('Vercel API fetch failed:', error);
        return { projects: [] };
    } finally {
        console.timeEnd('getVercelProjects');
    }
}, ['getVercelProjects'], { revalidate: HOURS_12 });

/** Cache revalidated every 12 hours. */
export const getNextjsLatestRelease = unstable_cache(async () => {
    const nextjsLatest = await fetchGitHubGraphQL(`
        query GetNextJsLatestRelease($repoName: String!, $owner: String!) {
            repository(name: $repoName, owner: $owner) {
                latestRelease {
                    tagName
                    updatedAt
                }
            }
        }
    `, { repoName: 'next.js', owner: 'vercel' }, {
        context: 'latest Next.js release',
        fallback: { repository: { latestRelease: null } },
    });

    if (!nextjsLatest.repository?.latestRelease) {
        return {};
    }

    return {
        tagName: cleanVersionTag(nextjsLatest.repository.latestRelease.tagName),
        updatedAt: nextjsLatest.repository.latestRelease.updatedAt,
    };
}, ['getNextjsLatestRelease'], { revalidate: HOURS_1 });

/**
 * Clean version from package.json dependency to extract just the semantic version
 * @param {string} versionSpec - Version specification from package.json (e.g., "^5.13.5", "~4.10.0")
 * @returns {string} Clean semantic version string
 */
function cleanDependencyVersion(versionSpec) {
    if (typeof versionSpec !== 'string') {
        return '';
    }

    // Remove version range specifiers like ^, ~, >=, etc.
    return versionSpec.replace(/^[\^~>=<]+/, '');
}

/**
 * Clean version tag from GitHub releases to extract just the semantic version
 * @param {string} tagName - Raw tag name from GitHub release
 * @returns {string} Clean semantic version string
 */
function cleanVersionTag(tagName) {
    if (typeof tagName !== 'string') {
        return '';
    }

    // Remove leading 'v'
    let cleaned = tagName.replace(/^v/, '');
    // Remove package name prefixes like "astro@", "next@", etc.
    cleaned = cleaned.replace(/^[^@]*@/, '');
    return cleaned;
}

/**
 * Generic function to get latest release for any framework from GitHub
 * @param {string} repoName - Repository name
 * @param {string} owner - Repository owner
 * @param {string} cacheKey - Unique cache key for this framework
 * @returns {Object} Object with tagName and updatedAt
 */
export const getFrameworkLatestRelease = unstable_cache(async (repoName, owner, cacheKey) => {
    const latest = await fetchGitHubGraphQL(`
        query GetFrameworkLatestRelease($repoName: String!, $owner: String!) {
            repository(name: $repoName, owner: $owner) {
                latestRelease {
                    tagName
                    updatedAt
                }
            }
        }
    `, { repoName, owner }, {
        context: `latest release for ${owner}/${repoName}`,
        fallback: { repository: { latestRelease: null } },
    });

    if (!latest.repository?.latestRelease) {
        console.error(`No latest release found for ${owner}/${repoName}`);
        return {};
    }

    return {
        tagName: cleanVersionTag(latest.repository.latestRelease.tagName),
        updatedAt: latest.repository.latestRelease.updatedAt,
    };
}, (repoName, owner, cacheKey) => ['getFrameworkLatestRelease', cacheKey || `${owner}/${repoName}`], { revalidate: HOURS_1 });

// Specific functions for each framework
export const getAstroLatestRelease = () => getFrameworkLatestRelease('astro', 'withastro', 'astro');
export const getNuxtLatestRelease = () => getFrameworkLatestRelease('nuxt', 'nuxt', 'nuxt');
export const getSvelteKitLatestRelease = () => getFrameworkLatestRelease('kit', 'sveltejs', 'sveltekit');
export const getRemixLatestRelease = () => getFrameworkLatestRelease('remix', 'remix-run', 'remix');
export const getGatsbyLatestRelease = () => getFrameworkLatestRelease('gatsby', 'gatsbyjs', 'gatsby');

const getRepositoryContentInfo = unstable_cache(async (username, reponame) => {
    const response = await fetchGitHubGraphQL(`
        query GetRepositoryContentInfo($owner: String!, $repoName: String!) {
            repository(name: $repoName, owner: $owner) {
                packageJson: object(expression: "HEAD:package.json") {
                    ... on Blob {
                        text
                    }
                }
                pagesAppJsx: object(expression: "HEAD:pages/_app.jsx") {
                    __typename
                }
                pagesAppTsx: object(expression: "HEAD:pages/_app.tsx") {
                    __typename
                }
                appLayoutJsx: object(expression: "HEAD:app/layout.jsx") {
                    __typename
                }
                appLayoutTsx: object(expression: "HEAD:app/layout.tsx") {
                    __typename
                }
            }
        }
    `, { owner: username, repoName: reponame }, {
        context: `repository content info for ${username}/${reponame}`,
        fallback: { repository: null },
    });

    return response.repository;
}, (username, reponame) => ['getRepositoryContentInfo', username, reponame], { revalidate: HOURS_1 });

export const getRepositoryPackageJson = unstable_cache(async (username, reponame) => {
    const repository = await getRepositoryContentInfo(username, reponame);
    const packageJsonText = repository?.packageJson?.text;

    if (!packageJsonText) {
        return null;
    }

    try {
        return JSON.parse(packageJsonText);
    } catch (error) {
        console.error(`Failed to parse package.json for ${username}/${reponame}:`, error);
        return null;
    }
}, (username, reponame) => ['getRepositoryPackageJson', username, reponame], { revalidate: HOURS_1 });

export const getRecentUserActivity = unstable_cache(async (username) => {
    console.log('Fetching recent activity for', username);
    console.time('getRecentUserActivity');
    const response = await fetchPaginatedGitHubArray(`${GITHUB_API_URL}/users/${username}/events?per_page=100`, {
        context: `recent activity for ${username}`,
    });
    console.timeEnd('getRecentUserActivity');
    return response;
}, (username) => ['getRecentUserActivity', username], { revalidate: MINUTES_5 });

export const getTrafficPageViews = unstable_cache(async (username, reponame) => {
    const response = await fetchGitHubJson(`${GITHUB_API_URL}/repos/${username}/${reponame}/traffic/views`, {
        context: `traffic views for ${username}/${reponame}`,
        fallback: {},
    });

    const sumUniques = response.uniques || 0;

    // Yesterday date in format YYYY-MM-DD (GitHub API has 24-hour delay).
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // Last day with at least one view (most recent complete day).
    const todayUniques = response.views?.find((day) => day.timestamp.startsWith(yesterday))?.uniques || 0;

    return { sumUniques, todayUniques };
}, (username, reponame) => ['getTrafficPageViews', username, reponame], { revalidate: HOURS_1 });

export const getDependabotAlerts = unstable_cache(async (username, reponame) => {
    const response = await fetchGitHubJson(`${GITHUB_API_URL}/repos/${username}/${reponame}/dependabot/alerts`, {
        context: `Dependabot alerts for ${username}/${reponame}`,
        fallback: [],
        next: { revalidate: HOURS_12 },
    });

    // Id dependabot is not enabled, the response will be an object, not an array.
    if (!Array.isArray(response)) {
        return [];
    }
    const openAlertsBySeverity = response.reduce((acc, alert) => {
        if (alert.state === 'open') {
            acc[alert.security_advisory.severity] = acc[alert.security_advisory.severity] ? acc[alert.security_advisory.severity] + 1 : 1;
        }
        return acc;
    }, {});

    return openAlertsBySeverity;
}, (username, reponame) => ['getDependabotAlerts', username, reponame], { revalidate: HOURS_12 });

/**
 * Determines if a repository is using Next.js App Router or legacy pages/_app.jsx. Or both.
 * Using unstable_cache because fetch calls are not cached when failing. This is the case when eg _app.jsx is not found.
 * @param {*} repoOwner GitHub username
 * @param {string} repoName repository name
 * @returns Object with two booleans: isRouterPages and isRouterApp
 */
export const checkAppJsxExistence = unstable_cache(async (repoOwner, repoName) => {
    const repository = await getRepositoryContentInfo(repoOwner, repoName);

    return {
        isRouterPages: Boolean(repository?.pagesAppJsx || repository?.pagesAppTsx),
        isRouterApp: Boolean(repository?.appLayoutJsx || repository?.appLayoutTsx),
    };
}, (repoOwner, repoName) => ['checkAppJsxExistence', repoOwner, repoName], { revalidate: HOURS_24 });

async function fetchCopilotPRCountChunk(repositories) {
    if (!repositories.length) {
        return {};
    }

    const variableDefinitions = repositories.map((_, index) => `$q${index}: String!`).join(', ');
    const searches = repositories.map((_, index) => `
        repo${index}: search(type: ISSUE, query: $q${index}, first: 1) {
            issueCount
        }
    `).join('\n');
    const variables = Object.fromEntries(
        repositories.map((project, index) => [
            `q${index}`,
            `is:pr is:merged author:copilot-swe-agent[bot] involves:${project.owner.login} repo:${project.owner.login}/${project.name}`
        ])
    );

    const response = await fetchGitHubGraphQL(`
        query BatchCopilotPRCounts(${variableDefinitions}) {
            ${searches}
        }
    `, variables, {
        context: `batched Copilot PR counts for ${repositories.length} repositories`,
        fallback: {},
        next: { revalidate: HOURS_12 },
    });

    return repositories.reduce((acc, project, index) => {
        acc[getRepositoryKey(project)] = response[`repo${index}`]?.issueCount || 0;
        return acc;
    }, {});
}

async function getCopilotPRCounts(repositories) {
    const counts = await Promise.all(chunkItems(repositories, 20).map(fetchCopilotPRCountChunk));
    return counts.reduce((acc, chunkResult) => ({ ...acc, ...chunkResult }), {});
}

async function getRepositoryVercelDetails(username, reponame, nextjsLatestRelease) {
    try {
        const [packageJson, routerInfo, repositoryFrameworks] = await Promise.all([
            getRepositoryPackageJson(username, reponame),
            checkAppJsxExistence(username, reponame),
            getRepositoryFrameworks(username, reponame),
        ]);

        return {
            nextjsLatestRelease,
            packageJson,
            isRouterPages: routerInfo.isRouterPages,
            isRouterApp: routerInfo.isRouterApp,
            repositoryFrameworks,
        };
    } catch (error) {
        console.error(`Failed to enrich Vercel data for ${username}/${reponame}:`, error);
        return createEmptyVercelDetails(nextjsLatestRelease);
    }
}

async function enrichProjectsForCards(projects, resolvedUsername) {
    const ownerProjects = projects.filter((project) => isOwnedRepository(project, resolvedUsername));
    const [copilotPRCounts, nextjsLatestRelease] = await Promise.all([
        getCopilotPRCounts(ownerProjects),
        projects.some((project) => project.vercel) ? getNextjsLatestRelease() : Promise.resolve({}),
    ]);

    return Promise.all(projects.map(async (project) => {
        const repoOwner = project.owner?.login;
        const isOwnerRepo = isOwnedRepository(project, resolvedUsername);
        const [views, openAlertsBySeverity, vercelDetails] = await Promise.all([
            isOwnerRepo ? getTrafficPageViews(repoOwner, project.name) : Promise.resolve(null),
            isOwnerRepo ? getDependabotAlerts(repoOwner, project.name) : Promise.resolve(null),
            project.vercel ? getRepositoryVercelDetails(repoOwner, project.name, nextjsLatestRelease) : Promise.resolve(null),
        ]);

        return {
            ...project,
            ownerMetrics: {
                isOwnerRepo,
                views,
                openAlertsBySeverity,
                copilotPRCount: isOwnerRepo ? (copilotPRCounts[getRepositoryKey(project)] || 0) : null,
            },
            vercel: project.vercel ? {
                ...project.vercel,
                details: vercelDetails ?? createEmptyVercelDetails(nextjsLatestRelease),
            } : undefined,
        };
    }));
}

export const getProjectsPageData = unstable_cache(async (username) => {
    const [
        repositories,
        pinnedNames,
        vercelProjects
    ] = await Promise.all([
        getRepos(username),
        getPinnedRepos(username),
        getVercelProjects()
    ]);

    const vercelProjectsByName = new Map(
        vercelProjects.projects
            .filter((project) => repositories.some((repo) => repo.name === project.name))
            .map((project) => [project.name, {
                framework: project.framework,
                name: project.name,
                nodeVersion: project.nodeVersion,
                link: project.link,
                description: project.description,
            }])
    );

    const repositoriesWithVercel = repositories.map((repo) => ({
        ...repo,
        vercel: vercelProjectsByName.get(repo.name),
    }));

    const heroes = repositoriesWithVercel
        .filter((project) => pinnedNames.includes(project.name))
        .sort((a, b) => b.stargazers_count - a.stargazers_count);
    const sorted = repositoriesWithVercel
        .filter((p) => !p.private)
        .filter((p) => !p.fork)
        .filter((p) => !p.archived)
        .filter((p) => !pinnedNames.includes(p.name))
        .filter((p) => !data.projects.blacklist.includes(p.name))
        .sort(
            (a, b) =>
                new Date(b.updated_at ?? Number.POSITIVE_INFINITY).getTime() -
                new Date(a.updated_at ?? Number.POSITIVE_INFINITY).getTime(),
        );

    const enrichedProjects = await enrichProjectsForCards([...heroes, ...sorted], username);
    const enrichedProjectsByKey = new Map(enrichedProjects.map((project) => [getRepositoryKey(project), project]));

    return {
        heroes: heroes.map((project) => enrichedProjectsByKey.get(getRepositoryKey(project)) ?? project),
        sorted: sorted.map((project) => enrichedProjectsByKey.get(getRepositoryKey(project)) ?? project),
    };
}, (username) => ['getProjectsPageData', username], { revalidate: HOURS_1 });

/**
 * Get the number of merged pull requests created by Copilot.
 * Uses GitHub GraphQL API to search for PRs authored by copilot-swe-agent[bot]
 * that involve the specified user in the specified repository.
 * @param {string} username GitHub username
 * @param {string} reponame repository name
 * @returns {number} Number of merged Copilot PRs
 */
export const getCopilotPRs = unstable_cache(async (username, reponame) => {
    const repo = `${username}/${reponame}`;
    console.log(`Fetching Copilot PRs for ${repo}`);
    console.time('getCopilotPRs-' + repo);

    try {
        const query = `is:pr is:merged author:copilot-swe-agent[bot] involves:${username} repo:${username}/${reponame}`;
        const response = await fetchGitHubGraphQL(`
            query CopilotAuthoredMergedPRs($q: String!, $after: String) {
                search(type: ISSUE, query: $q, first: 50, after: $after) {
                    issueCount
                }
            }
        `, { q: query }, {
            context: `Copilot PRs for ${username}/${reponame}`,
            fallback: { search: { issueCount: 0 } },
            next: { revalidate: HOURS_12 },
        });
        console.timeEnd('getCopilotPRs-' + repo);

        return response.search?.issueCount || 0;
    } catch (error) {
        console.error(`Error getting Copilot PRs for ${username}/${reponame}:`, error);
        console.timeEnd('getCopilotPRs-' + repo);
        return 0;
    }
}, (username, reponame) => ['getCopilotPRs', username, reponame], { revalidate: HOURS_12 });

/**
 * Get the total number of merged pull requests created by Copilot across all repositories for a user.
 * Uses GitHub GraphQL API to search for PRs authored by copilot-swe-agent[bot]
 * that involve the specified user (account-wide, not repository-specific).
 * @param {string} username GitHub username
 * @returns {number} Number of merged Copilot PRs across all repositories
 */
export const getCopilotPRsAccountWide = unstable_cache(async (username) => {
    console.log(`Fetching account-wide Copilot PRs for ${username}`);
    console.time('getCopilotPRsAccountWide');

    try {
        const query = `is:pr is:merged author:copilot-swe-agent[bot] involves:${username}`;
        const response = await fetchGitHubGraphQL(`
            query CopilotAuthoredMergedPRsAccountWide($q: String!) {
                search(type: ISSUE, query: $q, first: 1) {
                    issueCount
                }
            }
        `, { q: query }, {
            context: `account-wide Copilot PRs for ${username}`,
            fallback: { search: { issueCount: 0 } },
        });

        return response.search?.issueCount || 0;
    } catch (error) {
        console.error(`Error getting account-wide Copilot PRs for ${username}:`, error);
        return 0;
    } finally {
        console.timeEnd('getCopilotPRsAccountWide');
    }
}, (username) => ['getCopilotPRsAccountWide', username], { revalidate: HOURS_12 });

/**
 * Detects frameworks from package.json dependencies and devDependencies
 * @param {Object} packageJson - Parsed package.json content
 * @returns {Array} Array of detected frameworks with their versions
 */
export function detectFrameworks(packageJson) {
    if (!packageJson) return [];

    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const frameworks = [];

    // Framework detection rules
    const frameworkMap = {
        'next': {
            name: 'Next.js',
            type: 'nextjs',
            getLatestRelease: getNextjsLatestRelease
        },
        'astro': {
            name: 'Astro',
            type: 'astro',
            getLatestRelease: getAstroLatestRelease
        },
        'nuxt': {
            name: 'Nuxt',
            type: 'nuxt',
            getLatestRelease: getNuxtLatestRelease
        },
        '@sveltejs/kit': {
            name: 'SvelteKit',
            type: 'sveltekit',
            getLatestRelease: getSvelteKitLatestRelease
        },
        '@remix-run/react': {
            name: 'Remix',
            type: 'remix',
            getLatestRelease: getRemixLatestRelease
        },
        'gatsby': {
            name: 'Gatsby',
            type: 'gatsby',
            getLatestRelease: getGatsbyLatestRelease
        }
    };

    // Check for each framework
    for (const [dep, framework] of Object.entries(frameworkMap)) {
        if (dependencies[dep]) {
            const version = cleanDependencyVersion(dependencies[dep]);
            frameworks.push({
                ...framework,
                version,
                dependency: dep
            });
        }
    }

    return frameworks;
}

/**
 * Compare semantic versions
 * @param {string} version1 - First version to compare
 * @param {string} version2 - Second version to compare
 * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
function compareVersions(version1, version2) {
    const parseVersion = (v) => {
        // Remove any leading 'v' and split by dots
        const cleaned = v.replace(/^v/, '').split('.');
        return cleaned.map(num => parseInt(num, 10) || 0);
    };
    
    const v1 = parseVersion(version1);
    const v2 = parseVersion(version2);
    
    const maxLength = Math.max(v1.length, v2.length);
    
    for (let i = 0; i < maxLength; i++) {
        const num1 = v1[i] || 0;
        const num2 = v2[i] || 0;
        
        if (num1 < num2) return -1;
        if (num1 > num2) return 1;
    }
    
    return 0;
}

/**
 * Get framework information with version comparison for a repository
 * @param {string} username - GitHub username
 * @param {string} reponame - Repository name
 * @returns {Array} Array of framework info with upgrade status
 */
export const getRepositoryFrameworks = unstable_cache(async (username, reponame) => {
    const packageJson = await getRepositoryPackageJson(username, reponame);
    const detectedFrameworks = detectFrameworks(packageJson);
    
    const frameworksWithLatest = await Promise.all(
        detectedFrameworks.map(async (framework) => {
            try {
                const latestRelease = await framework.getLatestRelease();
                const hasUpgrade = framework.version && latestRelease.tagName && 
                                   compareVersions(framework.version, latestRelease.tagName) < 0;
                
                return {
                    ...framework,
                    latestVersion: latestRelease.tagName,
                    hasUpgrade,
                    latestUpdatedAt: latestRelease.updatedAt
                };
            } catch (error) {
                console.error(`Error getting latest release for ${framework.name}:`, error);
                return {
                    ...framework,
                    latestVersion: null,
                    hasUpgrade: false
                };
            }
        })
    );

    return frameworksWithLatest;
}, (username, reponame) => ['getRepositoryFrameworks', username, reponame], { revalidate: HOURS_1 });
