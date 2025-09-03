// Note: This API will be replaced by use cache when it reaches stability.
import { unstable_cache } from 'next/cache';

const revalidate = 60;
const MINUTES_5 = 60 * 5;
const HOURS_1 = 60 * 60;
const HOURS_12 = 60 * 60 * 12;
const HOURS_24 = 60 * 60 * 24;

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
    try {
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
    } catch (error) {
        console.error('Vercel API fetch failed:', error);
        return { projects: [] };
    }
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

/**
 * Generic function to get latest release for any framework from GitHub
 * @param {string} repoName - Repository name
 * @param {string} owner - Repository owner
 * @param {string} cacheKey - Unique cache key for this framework
 * @returns {Object} Object with tagName and updatedAt
 */
export const getFrameworkLatestRelease = unstable_cache(async (repoName, owner, cacheKey) => {
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
        next: { revalidate: HOURS_12 },
        body: JSON.stringify({
            query: `{
                repository(name: "${repoName}", owner: "${owner}") {
                    latestRelease {
                        tagName
                        updatedAt
                    }
                }
            }`
        }),
    });
    if (!res.ok) {
        console.error(`GitHub API returned an error for ${owner}/${repoName}:`, res.status, res.statusText);
        return {};
    }
    const latest = await res.json();

    if (!latest.data?.repository?.latestRelease) {
        console.error(`No latest release found for ${owner}/${repoName}`);
        return {};
    }

    const result = {
        tagName: latest.data.repository.latestRelease.tagName.replace('v', ''),
        updatedAt: latest.data.repository.latestRelease.updatedAt,
    }
    return result;
}, ['getFrameworkLatestRelease'], { revalidate: HOURS_1 });

// Specific functions for each framework
export const getAstroLatestRelease = () => getFrameworkLatestRelease('astro', 'withastro', 'astro');
export const getNuxtLatestRelease = () => getFrameworkLatestRelease('nuxt', 'nuxt', 'nuxt');
export const getSvelteKitLatestRelease = () => getFrameworkLatestRelease('kit', 'sveltejs', 'sveltekit');
export const getRemixLatestRelease = () => getFrameworkLatestRelease('remix', 'remix-run', 'remix');
export const getGatsbyLatestRelease = () => getFrameworkLatestRelease('gatsby', 'gatsbyjs', 'gatsby');

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
        console.error('Error parsing package.json', username, reponame, error);
        return null;
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
    const urlPagesAppTsx = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/pages/_app.tsx`;
    const urlAppLayout = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/app/layout.jsx`;
    const urlAppLayoutTsx = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/app/layout.tsx`;

    const res = {
        isRouterPages: false,
        isRouterApp: false,
    };

    try {
        // First, try JSX versions
        const [ isPagesRes, isAppLayoutRes ] = await Promise.all([
            fetch(urlPagesApp, {
                headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
                next: { revalidate: HOURS_24 }
            }),
            fetch(urlAppLayout, {
                headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
                next: { revalidate: HOURS_24 }
            }),
        ]);

        if (isPagesRes.status === 200) {
            res.isRouterPages = true;
        }

        if (isAppLayoutRes.status === 200) {
            res.isRouterApp = true;
        }

        // If JSX endpoints didn't resolve, try TSX fallbacks
        if (!res.isRouterPages) {
            const isPagesResTsx = await fetch(urlPagesAppTsx, {
                headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
                next: { revalidate: HOURS_24 }
            });
            if (isPagesResTsx.status === 200) {
                res.isRouterPages = true;
            }
        }

        if (!res.isRouterApp) {
            const isAppLayoutResTsx = await fetch(urlAppLayoutTsx, {
                headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
                next: { revalidate: HOURS_24 }
            });
            if (isAppLayoutResTsx.status === 200) {
                res.isRouterApp = true;
            }
        }
    } catch (error) {
        console.error(`Error checking _app.jsx existence in ${repoName}: ${error.message}`);
    }

    return res;
}, ['checkAppJsxExistence'], { revalidate: HOURS_24 });

/**
 * Get the number of merged pull requests created by Copilot in the last 2 weeks.
 * Identifies Copilot PRs by:
 * - Author: github-actions[bot] or accounts containing "copilot"
 * - Labels: containing "copilot" or "github-copilot"
 * @param {string} username GitHub username
 * @param {string} reponame repository name
 * @returns {number} Number of merged Copilot PRs in the last 2 weeks
 */
export const getCopilotPRs = unstable_cache(async (username, reponame) => {
    // Calculate date 2 weeks ago
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const since = twoWeeksAgo.toISOString();

    try {
        // Get merged pull requests from the last 2 weeks
        const res = await fetch(`https://api.github.com/repos/${username}/${reponame}/pulls?state=closed&sort=updated&direction=desc&since=${since}&per_page=100`, {
            headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
            // Result is bigger than 2MB and cannot be cached by default.
            // next: { revalidate: HOURS_12 }
        });

        if (!res.ok) {
            console.error(`Error fetching PRs for ${username}/${reponame}:`, res.status, res.statusText);
            return 0;
        }

        const prs = await res.json();
        
        // Filter for merged PRs that were created by Copilot
        const copilotPRs = prs.filter(pr => {
            // Must be merged and within the last 2 weeks
            if (!pr.merged_at) return false;
            
            const mergedDate = new Date(pr.merged_at);
            if (mergedDate < twoWeeksAgo) return false;

            // Check if author is Copilot-related
            const authorLogin = pr.user?.login?.toLowerCase() || '';
            const isCopilotAuthor = authorLogin.includes('copilot');

            // Check if PR has Copilot-related labels
            const hasCopilotLabel = pr.labels?.some(label => 
                label.name.toLowerCase().includes('copilot') ||
                label.name.toLowerCase().includes('github-copilot')
            );

            return isCopilotAuthor || hasCopilotLabel;
        });

        return copilotPRs.length;
    } catch (error) {
        console.error(`Error getting Copilot PRs for ${username}/${reponame}:`, error);
        return 0;
    }
}, ['getCopilotPRs'], { revalidate: HOURS_12 });

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
            const version = dependencies[dep].replace(/[\^~]/, '');
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
                                   framework.version < latestRelease.tagName;
                
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
}, ['getRepositoryFrameworks'], { revalidate: HOURS_1 });
