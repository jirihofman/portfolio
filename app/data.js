// Using unstable_cache for data fetching functions to improve performance.
// These wrappers provide automatic caching with configurable revalidation times.
import { unstable_cache } from 'next/cache';
import data from '../data.json';
import { GitHubRequestError } from '../lib/github-errors.mjs';
import { createHash } from 'node:crypto';
import { singleFlight, normalizeGitHubArguments } from '../lib/single-flight.mjs';
import { scheduleGitHubRequest, admitGitHubLookup } from '../lib/github-request-scheduler.mjs';

const revalidate = 60;
const MINUTES_5 = 60 * 5;
const HOURS_1 = 60 * 60;
const HOURS_6 = 60 * 60 * 6;
const HOURS_12 = 60 * 60 * 12;
const HOURS_24 = 60 * 60 * 24;
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_GRAPHQL_URL = `${GITHUB_API_URL}/graphql`;
const AGENT_GRAPHQL_BATCH_SIZE = 10;
const AGENT_BATCH_CONCURRENCY = 2;
const EXTERNAL_FETCH_TIMEOUT_MS = 10_000;
const PROJECT_ENRICHMENT_CONCURRENCY = 5;
const PORTFOLIO_OWNER_USERNAME = process.env.GITHUB_USERNAME || data.githubUsername;

// Normalize before both cache lookup and in-flight lookup. Credential changes
// invalidate permission-dependent data without putting secrets into cache keys.
function cacheData(load, keys, options) {
    const scope = createHash('sha256').update(JSON.stringify([
        process.env.GH_TOKEN || '', process.env.VC_TOKEN || '',
    ])).digest('hex');
    const cached = unstable_cache(singleFlight(load), ['github-data-v4', scope, ...keys], options);
    return singleFlight(cached, normalizeGitHubArguments);
}

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

// Fail inside the persistent cache; callers apply optional display fallbacks outside it.
async function fetchGitHubResponse(url, { context, method = 'GET', body, headers } = {}) {
    if (!process.env.GH_TOKEN && (url === GITHUB_GRAPHQL_URL || /\/(traffic\/views|dependabot\/alerts)(?:\?|$)/.test(url))) {
        throw new GitHubRequestError('GitHub authentication is required for this data.', 401);
    }
    const options = { method, body, headers: getGitHubHeaders(headers), cache: 'no-store' };
    const res = await scheduleGitHubRequest(url, options, (signal) => fetch(url, { ...options, signal }));
    if (!res.ok) {
        throw new GitHubRequestError(`GitHub API returned ${res.status} for ${context}.`, res.status);
    }
    if (!(res.headers.get('content-type') || '').includes('application/json')) {
        throw new GitHubRequestError(`GitHub API returned a non-JSON response for ${context}.`);
    }
    return { ok: true, data: await res.json(), headers: res.headers };
}

async function fetchGitHubJson(url, options) {
    const response = await fetchGitHubResponse(url, options);
    return response.data;
}

async function fetchGitHubGraphQL(query, variables, { context } = {}) {
    const response = await fetchGitHubResponse(GITHUB_GRAPHQL_URL, {
        context,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    if (response.data?.errors || !response.data?.data) {
        throw new GitHubRequestError(`GitHub GraphQL failed for ${context}.`);
    }
    return response.data.data;
}

function getNextPageUrl(linkHeader, currentUrl) {
    const nextLink = linkHeader?.split(',').find((link) => /rel="next"/.test(link));
    if (!nextLink) return null;
    const target = nextLink.match(/<([^>]+)>/)?.[1];
    if (!target) throw new GitHubRequestError('GitHub returned an invalid pagination link.');
    const nextUrl = new URL(target, currentUrl);
    const current = new URL(currentUrl);
    // GitHub's repository list links can switch from a login to its numeric user ID.
    // Subsequent pages must keep that canonical path; other endpoints cannot switch.
    const isCanonicalUserRepos = /^\/users\/[^/]+\/repos$/.test(current.pathname)
        && /^\/user\/[1-9]\d*\/repos$/.test(nextUrl.pathname);
    // Never forward authorization to another origin or a URL with embedded credentials.
    if (nextUrl.origin !== current.origin || (nextUrl.pathname !== current.pathname && !isCanonicalUserRepos)
        || nextUrl.username || nextUrl.password) {
        throw new GitHubRequestError('GitHub returned an unexpected pagination target.');
    }
    return nextUrl.href;
}

async function fetchPaginatedGitHubArray(initialUrl, { context } = {}) {
    const items = [];
    const seen = new Set();
    let url = initialUrl;
    while (url) {
        if (seen.has(url)) throw new GitHubRequestError('GitHub returned a repeated pagination link.');
        seen.add(url);
        const response = await fetchGitHubResponse(url, { context });
        if (!Array.isArray(response.data)) {
            throw new GitHubRequestError(`GitHub API returned an unexpected payload for ${context}.`);
        }
        items.push(...response.data);
        url = getNextPageUrl(response.headers.get('link'), url);
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
        nextjsVersion: '',
        astroVersion: '',
        nextjsLatestVersion: nextjsLatestRelease.tagName || '',
        routerMode: 'none',
        repositoryFrameworks: [],
        isUsingTurbopack: false,
        uiLibraries: [],
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

export async function getOptionalValue(factory, fallback, context) {
    try {
        return await factory();
    } catch (error) {
        console.error(`Failed to fetch optional data for ${context}:`, error);
        return cloneFallbackValue(fallback);
    }
}

async function mapWithConcurrency(items, concurrency, mapper) {
    if (!items.length) {
        return [];
    }

    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, concurrency), items.length);

    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex++;
            results[index] = await mapper(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

function buildCopilotRepoSearchQuery(username, reponame) {
    if (typeof username !== 'string' || typeof reponame !== 'string') {
        return null;
    }

    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username) || !/^[a-zA-Z0-9._-]{1,100}$/.test(reponame)) {
        return null;
    }

    return `is:pr is:merged author:copilot-swe-agent[bot] involves:${username} repo:${username}/${reponame}`;
}

function buildCopilotAccountSearchQuery(username) {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
        return null;
    }

    return `is:pr is:merged author:copilot-swe-agent[bot] involves:${username}`;
}

function buildCodexCoauthoredCommitSearchQuery(username) {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
        return null;
    }

    return `author:${username} "Co-authored-by: Codex"`;
}

function buildClaudeCoauthoredCommitSearchQuery(username) {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
        return null;
    }

    return `author:${username} "Co-authored-by: Claude"`;
}

function buildCodexLabeledAccountSearchQuery(username) {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
        return null;
    }

    return `is:pr is:merged author:${username} label:codex`;
}

function buildClaudeLabeledAccountSearchQuery(username) {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
        return null;
    }

    return `is:pr is:merged author:${username} label:claude`;
}

function buildCodexLabeledPRRepoSearchQuery(username, reponame) {
    if (typeof username !== 'string' || typeof reponame !== 'string') {
        return null;
    }

    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username) || !/^[a-zA-Z0-9._-]{1,100}$/.test(reponame)) {
        return null;
    }

    return `is:pr is:merged author:${username} label:codex repo:${username}/${reponame}`;
}

function buildClaudeLabeledPRRepoSearchQuery(username, reponame) {
    if (typeof username !== 'string' || typeof reponame !== 'string') {
        return null;
    }

    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username) || !/^[a-zA-Z0-9._-]{1,100}$/.test(reponame)) {
        return null;
    }

    return `is:pr is:merged author:${username} label:claude repo:${username}/${reponame}`;
}

// TODO: Implement option to switch between info for authenticated user and other users.
export const getUser = cacheData(async (username) => {
    console.log('Fetching user data for', username);
    await admitGitHubLookup({ headers: getGitHubHeaders() });
    try {
        const response = await fetchGitHubJson(`${GITHUB_API_URL}/users/${username}`, {
            context: `user data for ${username}`,
        });
        if (!response?.id) throw new GitHubRequestError('GitHub returned an invalid user.');
        return response;
    } catch (error) {
        if (error.status === 404) return null;
        throw error;
    }
}, ['getUser-success-v3'], { revalidate });

// Use a new key to discard empty/partial lists cached by the old failure handling.
export const getRepos = cacheData(async (username) => {
    console.log('Fetching repos for', username);
    const response = await fetchPaginatedGitHubArray(`${GITHUB_API_URL}/users/${username}/repos?per_page=100`, {
        context: `repositories for ${username}`,
    });
    return response;
}, ['getRepos-success-v3'], { revalidate: HOURS_1 });

export const getSocialAccounts = cacheData(async (username) => {
    console.log('Fetching social accounts for', username);
    const response = await fetchGitHubJson(`${GITHUB_API_URL}/users/${username}/social_accounts`, {
        context: `social accounts for ${username}`,
    });
    if (!Array.isArray(response)) throw new GitHubRequestError('GitHub returned invalid social accounts.');
    return response;
}, ['getSocialAccounts-success-v3'], { revalidate: HOURS_12 });

export const getPinnedRepos = cacheData(async (username) => {
    console.log('Fetching pinned repos for', username);
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
    });
    return pinned.user?.pinnedItems?.nodes?.map((node) => node?.name).filter(Boolean) ?? [];
}, ['getPinnedRepos-success-v3'], { revalidate: HOURS_12 });

export const getUserOrganizations = cacheData(async (username) => {
    console.log('Fetching organizations for', username);
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
    });
    return { data: orgs };
}, ['getUserOrganizations-success-v3'], { revalidate: HOURS_12 });

export const getVercelProjects = cacheData(async () => {
    if (!process.env.VC_TOKEN) {
        console.log('No Vercel token found - no projects will be shown.');
        return { projects: [] };
    }
    console.log('Fetching Vercel projects');

    const baseUrl = 'https://api.vercel.com/v9/projects';
    const limit = 100;
    let nextCursor = null;
    let url = `${baseUrl}?limit=${limit}`;
    const allProjects = [];

    do {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${process.env.VC_TOKEN}` },
            signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
        });

        if (!res.ok) {
            throw new Error(`Vercel API returned ${res.status}.`);
        }

        const data = await res.json();

        if (!Array.isArray(data.projects)) throw new Error('Vercel returned invalid projects.');
        allProjects.push(...data.projects);
        nextCursor = data.pagination?.next || null;
        url = nextCursor ? `${baseUrl}?limit=${limit}&until=${nextCursor}` : '';
    } while (nextCursor);

    console.log('Vercel projects count:', allProjects.length);
    return { projects: allProjects };
}, ['getVercelProjects-success-v3'], { revalidate: HOURS_24 });

/** Cache revalidated every 6 hours. */
export const getNextjsLatestRelease = cacheData(async () => {
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
    });

    if (!nextjsLatest.repository?.latestRelease) {
        return {};
    }

    return {
        tagName: cleanVersionTag(nextjsLatest.repository.latestRelease.tagName),
        updatedAt: nextjsLatest.repository.latestRelease.updatedAt,
    };
}, ['getNextjsLatestRelease-success-v3'], { revalidate: HOURS_6 });

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
 * @returns {Object} Object with tagName and updatedAt
 */
export const getFrameworkLatestRelease = cacheData(async (repoName, owner) => {
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
    });

    if (!latest.repository?.latestRelease) {
        console.error(`No latest release found for ${owner}/${repoName}`);
        return {};
    }

    return {
        tagName: cleanVersionTag(latest.repository.latestRelease.tagName),
        updatedAt: latest.repository.latestRelease.updatedAt,
    };
}, ['getFrameworkLatestRelease-success-v3'], { revalidate: HOURS_6 });

// Specific functions for each framework
export const getAstroLatestRelease = () => getFrameworkLatestRelease('astro', 'withastro');
export const getNuxtLatestRelease = () => getFrameworkLatestRelease('nuxt', 'nuxt');
export const getSvelteKitLatestRelease = () => getFrameworkLatestRelease('kit', 'sveltejs');
export const getRemixLatestRelease = () => getFrameworkLatestRelease('remix', 'remix-run');
export const getGatsbyLatestRelease = () => getFrameworkLatestRelease('gatsby', 'gatsbyjs');

async function fetchRepositoryContentInfo(username, reponame) {
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
    });

    return response.repository;
}

const getRepositoryContentInfo = cacheData(
    fetchRepositoryContentInfo,
    ['getRepositoryContentInfo-success-v3'],
    { revalidate: HOURS_24 },
);

function parseRepositoryPackageJson(repository, username, reponame) {
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
}

function getRouterInfoFromRepository(repository) {
    return {
        isRouterPages: Boolean(repository?.pagesAppJsx || repository?.pagesAppTsx),
        isRouterApp: Boolean(repository?.appLayoutJsx || repository?.appLayoutTsx),
    };
}

export async function getRepositoryPackageJson(username, reponame) {
    const repository = await getRepositoryContentInfo(username, reponame);
    return parseRepositoryPackageJson(repository, username, reponame);
}

export const getRecentUserActivity = cacheData(async (username) => {
    console.log('Fetching recent activity for', username);
    const response = await fetchPaginatedGitHubArray(`${GITHUB_API_URL}/users/${username}/events?per_page=100`, {
        context: `recent activity for ${username}`,
    });
    return response;
}, ['getRecentUserActivity-success-v3'], { revalidate: MINUTES_5 });

export const getPublishedReleaseSummary = cacheData(async (username) => {
    let after = null;
    let releaseCount = 0;
    let repositoryCount = 0;

    do {
        const response = await fetchGitHubGraphQL(`
            query GetPublishedReleaseSummary($username: String!, $after: String) {
                user(login: $username) {
                    repositories(
                        first: 100
                        after: $after
                        ownerAffiliations: OWNER
                        privacy: PUBLIC
                    ) {
                        pageInfo {
                            endCursor
                            hasNextPage
                        }
                        nodes {
                            releases(first: 1) {
                                totalCount
                            }
                        }
                    }
                }
            }
        `, { username, after }, {
            context: `published release summary for ${username}`,
        });

        const repositories = response.user?.repositories;
        if (!Array.isArray(repositories?.nodes) || !repositories.pageInfo) {
            throw new GitHubRequestError('GitHub returned an incomplete release summary.');
        }

        for (const repository of repositories?.nodes ?? []) {
            const count = repository?.releases?.totalCount;
            if (typeof count !== 'number') throw new GitHubRequestError('GitHub returned an invalid release count.');
            releaseCount += count;
            repositoryCount += count > 0 ? 1 : 0;
        }

        after = repositories?.pageInfo?.hasNextPage ? repositories.pageInfo.endCursor : null;
    } while (after);

    return { releaseCount, repositoryCount };
}, ['getPublishedReleaseSummary-success-v3'], { revalidate: HOURS_6 });

export const getTrafficPageViews = cacheData(async (username, reponame) => {
    const response = await fetchGitHubResponse(`${GITHUB_API_URL}/repos/${username}/${reponame}/traffic/views`, {
        context: `traffic views for ${username}/${reponame}`,
    });

    if (!response.data || typeof response.data.uniques !== 'number' || !Array.isArray(response.data.views)) {
        throw new GitHubRequestError('GitHub returned invalid traffic metrics.');
    }

    const sumUniques = response.data.uniques || 0;

    // Yesterday date in format YYYY-MM-DD (GitHub API has 24-hour delay).
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // Last day with at least one view (most recent complete day).
    const todayUniques = response.data.views?.find((day) => day.timestamp.startsWith(yesterday))?.uniques || 0;

    return { sumUniques, todayUniques };
}, ['getTrafficPageViews-success-v3'], { revalidate: HOURS_6 });

export const getDependabotAlerts = cacheData(async (username, reponame) => {
    const alerts = await fetchPaginatedGitHubArray(
        `${GITHUB_API_URL}/repos/${username}/${reponame}/dependabot/alerts?state=open&per_page=100`,
        { context: `Dependabot alerts for ${username}/${reponame}` },
    );

    const openAlertsBySeverity = alerts.reduce((acc, alert) => {
        if (alert.state === 'open') {
            acc[alert.security_advisory.severity] = acc[alert.security_advisory.severity] ? acc[alert.security_advisory.severity] + 1 : 1;
        }
        return acc;
    }, {});

    return openAlertsBySeverity;
}, ['getDependabotAlerts-complete-v4'], { revalidate: HOURS_12 });

/**
 * Determines if a repository is using Next.js App Router or legacy pages/_app.jsx. Or both.
 * Standalone checks retain their 24-hour cache; projects-page enrichment derives this
 * value from its single cached repository content request instead.
 * @param {*} repoOwner GitHub username
 * @param {string} repoName repository name
 * @returns Object with two booleans: isRouterPages and isRouterApp
 */
export async function checkAppJsxExistence(repoOwner, repoName) {
    return getRouterInfoFromRepository(await getRepositoryContentInfo(repoOwner, repoName));
}

const fetchAgentCountChunk = cacheData(async (repositoryKeys) => {
    const repositories = repositoryKeys.map((key) => {
        const [owner, name] = key.split('/');
        return { full_name: key, owner: { login: owner }, name };
    });
    const searchableRepositories = repositories.filter((project) => {
        const owner = project.owner?.login;
        return buildCopilotRepoSearchQuery(owner, project.name)
            && buildCodexLabeledPRRepoSearchQuery(owner, project.name)
            && buildClaudeLabeledPRRepoSearchQuery(owner, project.name);
    });

    if (!searchableRepositories.length) {
        return { copilot: {}, codex: {}, claude: {} };
    }

    const variableDefinitions = searchableRepositories.flatMap((_, index) => [
        `$copilot${index}: String!`,
        `$codex${index}: String!`,
        `$claude${index}: String!`,
    ]).join(', ');
    const searches = searchableRepositories.map((_, index) => `
        copilot${index}: search(type: ISSUE, query: $copilot${index}, first: 1) {
            issueCount
        }
        codex${index}: search(type: ISSUE, query: $codex${index}, first: 1) {
            issueCount
        }
        claude${index}: search(type: ISSUE, query: $claude${index}, first: 1) {
            issueCount
        }
    `).join('\n');
    const variables = {};

    searchableRepositories.forEach((project, index) => {
        const owner = project.owner.login;
        variables[`copilot${index}`] = buildCopilotRepoSearchQuery(owner, project.name);
        variables[`codex${index}`] = buildCodexLabeledPRRepoSearchQuery(owner, project.name);
        variables[`claude${index}`] = buildClaudeLabeledPRRepoSearchQuery(owner, project.name);
    });

    const response = await fetchGitHubGraphQL(`
        query BatchProjectAgentCounts(${variableDefinitions}) {
            ${searches}
        }
    `, variables, {
        context: `batched agent counts for ${searchableRepositories.length} repositories`,
    });

    if (Object.keys(variables).some((alias) => typeof response[alias]?.issueCount !== 'number')) {
        throw new GitHubRequestError('GitHub returned incomplete agent counts.');
    }
    return searchableRepositories.reduce((counts, project, index) => {
        const key = getRepositoryKey(project);
        counts.copilot[key] = response[`copilot${index}`]?.issueCount ?? null;
        counts.codex[key] = response[`codex${index}`]?.issueCount ?? null;
        counts.claude[key] = response[`claude${index}`]?.issueCount ?? null;
        return counts;
    }, { copilot: {}, codex: {}, claude: {} });
}, ['agent-count-chunk-success-v1'], { revalidate: HOURS_12 });

async function getAgentCounts(repositories) {
    // Display order and changing repository metadata must not change query identity.
    const keys = [...new Set(repositories.map((project) => getRepositoryKey(project).toLowerCase()))].sort();
    const chunks = await mapWithConcurrency(
        chunkItems(keys, AGENT_GRAPHQL_BATCH_SIZE), AGENT_BATCH_CONCURRENCY,
        (chunk, index) => getOptionalValue(
            () => fetchAgentCountChunk(chunk),
            { copilot: {}, codex: {}, claude: {} },
            `agent count batch ${index + 1}`,
        ),
    );

    return chunks.reduce((counts, chunkResult) => {
        Object.assign(counts.copilot, chunkResult.copilot);
        Object.assign(counts.codex, chunkResult.codex);
        Object.assign(counts.claude, chunkResult.claude);
        return counts;
    }, { copilot: {}, codex: {}, claude: {} });
}

function getPackageDependencyVersion(packageJson, dependency) {
    const version = packageJson?.dependencies?.[dependency]
        ?? packageJson?.devDependencies?.[dependency];
    return cleanDependencyVersion(version);
}

function getRouterMode({ isRouterPages, isRouterApp }) {
    if (isRouterPages && isRouterApp) return 'hybrid';
    if (isRouterApp) return 'app';
    if (isRouterPages) return 'pages';
    return 'none';
}

function getRepositoryUiLibraries(packageJson) {
    const libraries = [];

    if (packageJson?.devDependencies?.tailwindcss || packageJson?.dependencies?.tailwindcss) {
        libraries.push('tailwindcss');
    }
    if (packageJson?.dependencies?.['react-bootstrap']) {
        libraries.push('react-bootstrap');
    }
    if (packageJson?.dependencies?.['@primer/react']) {
        libraries.push('primer');
    }

    return libraries;
}

async function getRepositoryVercelDetails(username, reponame, nextjsReleasePromise) {
    try {
        const [repository, nextjsLatestRelease] = await Promise.all([
            getRepositoryContentInfo(username, reponame), nextjsReleasePromise,
        ]);
        const packageJson = parseRepositoryPackageJson(repository, username, reponame);
        const routerInfo = getRouterInfoFromRepository(repository);
        const repositoryFrameworks = await getFrameworkDetails(packageJson);
        const nextjsVersion = getPackageDependencyVersion(packageJson, 'next');
        const astroVersion = getPackageDependencyVersion(packageJson, 'astro');
        const isNext16 = nextjsVersion && compareVersions(nextjsVersion, '16.0.0') >= 0;

        return {
            nextjsVersion,
            astroVersion,
            nextjsLatestVersion: nextjsLatestRelease.tagName || '',
            routerMode: getRouterMode(routerInfo),
            repositoryFrameworks: repositoryFrameworks.map((framework) => ({
                name: framework.name,
                type: framework.type,
                version: framework.version,
                latestVersion: framework.latestVersion,
                hasUpgrade: framework.hasUpgrade,
            })),
            isUsingTurbopack: Boolean(
                isNext16
                || packageJson?.scripts?.dev?.includes('--turbo')
                || packageJson?.scripts?.dev?.includes('--turbopack')
            ),
            uiLibraries: getRepositoryUiLibraries(packageJson),
        };
    } catch (error) {
        console.error(`Failed to enrich Vercel data for ${username}/${reponame}:`, error);
        return createEmptyVercelDetails();
    }
}

async function enrichProjectsForCards(projects) {
    const ownerProjects = projects.filter((project) => isOwnedRepository(project, PORTFOLIO_OWNER_USERNAME));
    const hasVercelProjects = projects.some((project) => project.vercel);
    const countsPromise = getOptionalValue(
        () => getAgentCounts(ownerProjects),
        { copilot: {}, codex: {}, claude: {} },
        'project agent counts',
    );
    const nextjsReleasePromise = hasVercelProjects
        ? getOptionalValue(() => getNextjsLatestRelease(), {}, 'latest Next.js release')
        : Promise.resolve({});

    // Independent reads begin immediately; the shared request scheduler bounds I/O.
    const enrichedPromise = mapWithConcurrency(projects, PROJECT_ENRICHMENT_CONCURRENCY, async (project) => {
        const repoOwner = project.owner?.login;
        const isOwnerRepo = isOwnedRepository(project, PORTFOLIO_OWNER_USERNAME);
        const [views, openAlertsBySeverity, vercelDetails] = await Promise.all([
            isOwnerRepo && repoOwner
                ? getOptionalValue(() => getTrafficPageViews(repoOwner, project.name), null, `traffic for ${repoOwner}/${project.name}`)
                : Promise.resolve(null),
            isOwnerRepo && repoOwner
                ? getOptionalValue(() => getDependabotAlerts(repoOwner, project.name), null, `Dependabot alerts for ${repoOwner}/${project.name}`)
                : Promise.resolve(null),
            project.vercel && repoOwner
                ? getOptionalValue(
                    () => getRepositoryVercelDetails(repoOwner, project.name, nextjsReleasePromise),
                    createEmptyVercelDetails(),
                    `Vercel details for ${repoOwner}/${project.name}`,
                )
                : Promise.resolve(null),
        ]);

        return {
            ...project,
            ownerMetrics: {
                isOwnerRepo,
                views,
                openAlertsBySeverity,
            },
            vercel: project.vercel ? {
                ...project.vercel,
                details: vercelDetails ?? createEmptyVercelDetails(),
            } : undefined,
        };
    });
    const [enrichedProjects, agentCounts] = await Promise.all([enrichedPromise, countsPromise]);
    return enrichedProjects.map((project) => {
        const key = getRepositoryKey(project).toLowerCase();
        return {
            ...project,
            ownerMetrics: {
                ...project.ownerMetrics,
                copilotPRCount: project.ownerMetrics.isOwnerRepo ? agentCounts.copilot[key] ?? null : null,
                codexCount: project.ownerMetrics.isOwnerRepo ? agentCounts.codex[key] ?? null : null,
                claudeCount: project.ownerMetrics.isOwnerRepo ? agentCounts.claude[key] ?? null : null,
            },
        };
    });
}


export function isPortfolioOwnerUsername(username) {
    return typeof username === 'string'
        && username.toLowerCase() === PORTFOLIO_OWNER_USERNAME.toLowerCase();
}

function selectVisibleProjects(repositories, pinnedNames) {
    const heroes = repositories
        .filter((project) => pinnedNames.includes(project.name))
        .sort((a, b) => b.stargazers_count - a.stargazers_count);
    const sorted = repositories
        .filter((project) => !project.private)
        .filter((project) => !project.fork)
        .filter((project) => !project.archived)
        .filter((project) => !pinnedNames.includes(project.name))
        .filter((project) => !data.projects.blacklist.includes(project.name))
        .sort(
            (a, b) =>
                new Date(b.updated_at ?? Number.POSITIVE_INFINITY).getTime() -
                new Date(a.updated_at ?? Number.POSITIVE_INFINITY).getTime(),
        );

    return { heroes, sorted };
}

function toProjectCardData(project) {
    const owner = project.owner?.login || '';

    return {
        full_name: project.full_name || `${owner}/${project.name}`,
        owner: { login: owner },
        name: project.name,
        homepage: project.homepage || '',
        html_url: project.html_url,
        created_at: project.created_at,
        stargazers_count: project.stargazers_count || 0,
        description: project.description || '',
    };
}

function getLinkedGitHubRepositoryKey(vercelProject) {
    const link = vercelProject?.link;

    if (!link || (link.type && link.type !== 'github')) {
        return null;
    }

    const owner = link.org || link.owner || link.repoOwner;
    const repository = link.repo;

    if (typeof owner !== 'string' || typeof repository !== 'string') {
        return null;
    }

    return `${owner}/${repository}`.toLowerCase();
}

export async function getProjectsPageData(username) {
    const [repositories, pinnedNames] = await Promise.all([
        getRepos(username),
        getOptionalValue(() => getPinnedRepos(username), [], `pinned repositories for ${username}`),
    ]);
    const { heroes, sorted } = selectVisibleProjects(repositories, pinnedNames);

    return {
        heroes: heroes.map(toProjectCardData),
        sorted: sorted.map(toProjectCardData),
        isPortfolioOwner: isPortfolioOwnerUsername(username),
    };
}

export async function getOwnerProjectSecondaryData() {
    const [{ heroes, sorted }, vercelProjects] = await Promise.all([
        getProjectsPageData(PORTFOLIO_OWNER_USERNAME),
        getOptionalValue(() => getVercelProjects(), { projects: [] }, 'Vercel projects'),
    ]);
    const projects = [...heroes, ...sorted].filter((project) =>
        isOwnedRepository(project, PORTFOLIO_OWNER_USERNAME)
    );
    const projectKeys = new Set(projects.map((project) => getRepositoryKey(project).toLowerCase()));
    const vercelProjectsByRepository = new Map(
        vercelProjects.projects
            .map((project) => [getLinkedGitHubRepositoryKey(project), project])
            .filter(([key]) => key && projectKeys.has(key))
            .map(([key, project]) => [key, {
                framework: project.framework || null,
                nodeVersion: project.nodeVersion || null,
            }])
    );
    const projectsWithVercel = projects.map((project) => ({
        ...project,
        vercel: vercelProjectsByRepository.get(getRepositoryKey(project).toLowerCase()),
    }));
    const enrichedProjects = await enrichProjectsForCards(projectsWithVercel);

    return Object.fromEntries(enrichedProjects.map((project) => [
        getRepositoryKey(project),
        {
            ownerMetrics: {
                views: project.ownerMetrics.views,
                openAlertsBySeverity: project.ownerMetrics.openAlertsBySeverity,
                copilotPRCount: project.ownerMetrics.copilotPRCount,
                codexCount: project.ownerMetrics.codexCount,
                claudeCount: project.ownerMetrics.claudeCount,
            },
            vercel: project.vercel || null,
        },
    ]));
}

/**
 * Get the number of merged pull requests created by Copilot.
 * Uses GitHub GraphQL API to search for PRs authored by copilot-swe-agent[bot]
 * that involve the specified user in the specified repository.
 * @param {string} username GitHub username
 * @param {string} reponame repository name
 * @returns {number} Number of merged Copilot PRs
 */
export const getCopilotPRs = cacheData(async (username, reponame) => {
    const repo = `${username}/${reponame}`;
    console.log(`Fetching Copilot PRs for ${repo}`);

    try {
        const query = buildCopilotRepoSearchQuery(username, reponame);

        if (!query) {
            return 0;
        }

        const response = await fetchGitHubGraphQL(`
            query CopilotAuthoredMergedPRs($q: String!, $after: String) {
                search(type: ISSUE, query: $q, first: 50, after: $after) {
                    issueCount
                }
            }
        `, { q: query }, {
            context: `Copilot PRs for ${username}/${reponame}`,
        });
        if (typeof response.search?.issueCount !== 'number') throw new GitHubRequestError('GitHub returned an invalid search count.');
        return response.search.issueCount;
    } catch (error) {
        console.error(`Error getting Copilot PRs for ${username}/${reponame}:`, error);
        throw error;
    }
}, ['getCopilotPRs-success-v3'], { revalidate: HOURS_12 });

/**
 * Get the total number of merged pull requests created by Copilot across all repositories for a user.
 * Uses GitHub GraphQL API to search for PRs authored by copilot-swe-agent[bot]
 * that involve the specified user (account-wide, not repository-specific).
 * @param {string} username GitHub username
 * @returns {number} Number of merged Copilot PRs across all repositories
 */
export const getCopilotPRsAccountWide = cacheData(async (username) => {
    console.log(`Fetching account-wide Copilot PRs for ${username}`);

    try {
        const query = buildCopilotAccountSearchQuery(username);

        if (!query) {
            return 0;
        }

        const response = await fetchGitHubGraphQL(`
            query CopilotAuthoredMergedPRsAccountWide($q: String!) {
                search(type: ISSUE, query: $q, first: 1) {
                    issueCount
                }
            }
        `, { q: query }, {
            context: `account-wide Copilot PRs for ${username}`,
        });

        if (typeof response.search?.issueCount !== 'number') throw new GitHubRequestError('GitHub returned an invalid search count.');
        return response.search.issueCount;
    } catch (error) {
        console.error(`Error getting account-wide Copilot PRs for ${username}:`, error);
        throw error;
    }
}, ['getCopilotPRsAccountWide-success-v3'], { revalidate: HOURS_12 });

/**
 * Get the total number of commits authored by the user that include the "Co-authored-by: Codex" trailer.
 * Uses GitHub commit search account-wide (not repository-specific).
 * @param {string} username GitHub username
 * @returns {number} Number of commits authored by the user that were co-authored by Codex
 */
export const getCodexCoauthoredCommitsAccountWide = cacheData(async (username) => {
    console.log(`Fetching account-wide Codex co-authored commits for ${username}`);

    try {
        const query = buildCodexCoauthoredCommitSearchQuery(username);

        if (!query) {
            return 0;
        }

        const response = await fetchGitHubJson(`${GITHUB_API_URL}/search/commits?q=${encodeURIComponent(query)}&per_page=1`, {
            context: `account-wide Codex co-authored commits for ${username}`,
            headers: { Accept: 'application/vnd.github.cloak-preview+json' },
        });

        if (typeof response?.total_count !== 'number' || response.incomplete_results) throw new GitHubRequestError('GitHub returned an incomplete commit count.');
        return response.total_count;
    } catch (error) {
        console.error(`Error getting account-wide Codex co-authored commits for ${username}:`, error);
        throw error;
    }
}, ['getCodexCoauthoredCommitsAccountWide-success-v3'], { revalidate: HOURS_12 });

/**
 * Get the total number of commits authored by the user that include the "Co-authored-by: Claude" trailer.
 * Uses GitHub commit search account-wide (not repository-specific).
 * @param {string} username GitHub username
 * @returns {number} Number of commits authored by the user that were co-authored by Claude
 */
export const getClaudeCoauthoredCommitsAccountWide = cacheData(async (username) => {
    console.log(`Fetching account-wide Claude co-authored commits for ${username}`);

    try {
        const query = buildClaudeCoauthoredCommitSearchQuery(username);

        if (!query) {
            return 0;
        }

        const response = await fetchGitHubJson(`${GITHUB_API_URL}/search/commits?q=${encodeURIComponent(query)}&per_page=1`, {
            context: `account-wide Claude co-authored commits for ${username}`,
            headers: { Accept: 'application/vnd.github.cloak-preview+json' },
        });

        if (typeof response?.total_count !== 'number' || response.incomplete_results) throw new GitHubRequestError('GitHub returned an incomplete commit count.');
        return response.total_count;
    } catch (error) {
        console.error(`Error getting account-wide Claude co-authored commits for ${username}:`, error);
        throw error;
    }
}, ['getClaudeCoauthoredCommitsAccountWide-success-v3'], { revalidate: HOURS_12 });

/**
 * Get the total number of merged pull requests authored by the user that have the "codex" label.
 * Uses GitHub GraphQL API to search account-wide (not repository-specific).
 * @param {string} username GitHub username
 * @returns {number} Number of merged, codex-labeled PRs authored by the user
 */
export const getCodexLabeledPRsAccountWide = cacheData(async (username) => {
    console.log(`Fetching account-wide codex-labeled PRs for ${username}`);

    try {
        const query = buildCodexLabeledAccountSearchQuery(username);

        if (!query) {
            return 0;
        }

        const response = await fetchGitHubGraphQL(`
            query CodexLabeledMergedPRsAccountWide($q: String!) {
                search(type: ISSUE, query: $q, first: 1) {
                    issueCount
                }
            }
        `, { q: query }, {
            context: `account-wide codex-labeled PRs for ${username}`,
        });

        if (typeof response.search?.issueCount !== 'number') throw new GitHubRequestError('GitHub returned an invalid search count.');
        return response.search.issueCount;
    } catch (error) {
        console.error(`Error getting account-wide codex-labeled PRs for ${username}:`, error);
        throw error;
    }
}, ['getCodexLabeledPRsAccountWide-success-v3'], { revalidate: HOURS_12 });

/**
 * Get the total number of merged pull requests authored by the user that have the "claude" label.
 * Uses GitHub GraphQL API to search account-wide (not repository-specific).
 * @param {string} username GitHub username
 * @returns {number} Number of merged, claude-labeled PRs authored by the user
 */
export const getClaudeLabeledPRsAccountWide = cacheData(async (username) => {
    console.log(`Fetching account-wide claude-labeled PRs for ${username}`);

    try {
        const query = buildClaudeLabeledAccountSearchQuery(username);

        if (!query) {
            return 0;
        }

        const response = await fetchGitHubGraphQL(`
            query ClaudeLabeledMergedPRsAccountWide($q: String!) {
                search(type: ISSUE, query: $q, first: 1) {
                    issueCount
                }
            }
        `, { q: query }, {
            context: `account-wide claude-labeled PRs for ${username}`,
        });

        if (typeof response.search?.issueCount !== 'number') throw new GitHubRequestError('GitHub returned an invalid search count.');
        return response.search.issueCount;
    } catch (error) {
        console.error(`Error getting account-wide claude-labeled PRs for ${username}:`, error);
        throw error;
    }
}, ['getClaudeLabeledPRsAccountWide-success-v3'], { revalidate: HOURS_12 });

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

async function getFrameworkDetails(packageJson) {
    const detectedFrameworks = detectFrameworks(packageJson);

    const frameworksWithLatest = await Promise.all(
        detectedFrameworks.map(async (framework) => {
            const { getLatestRelease, ...frameworkInfo } = framework;

            try {
                const latestRelease = await getLatestRelease();
                const hasUpgrade = framework.version && latestRelease.tagName &&
                                   compareVersions(framework.version, latestRelease.tagName) < 0;

                return {
                    ...frameworkInfo,
                    latestVersion: latestRelease.tagName,
                    hasUpgrade,
                    latestUpdatedAt: latestRelease.updatedAt
                };
            } catch (error) {
                console.error(`Error getting latest release for ${framework.name}:`, error);
                return {
                    ...frameworkInfo,
                    latestVersion: null,
                    hasUpgrade: false
                };
            }
        })
    );

    return frameworksWithLatest;
}

/**
 * Get framework information with version comparison for a repository.
 * Repository content is cached for 24 hours and framework releases for 6 hours.
 * @param {string} username - GitHub username
 * @param {string} reponame - Repository name
 * @returns {Array} Array of framework info with upgrade status
 */
export async function getRepositoryFrameworks(username, reponame) {
    const repository = await getRepositoryContentInfo(username, reponame);
    const packageJson = parseRepositoryPackageJson(repository, username, reponame);
    return getFrameworkDetails(packageJson);
}
