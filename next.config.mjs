import data from "./data.json" with { type: "json" };

const GITHUB_FETCH_TIMEOUT_MS = 5_000;

async function getGitHubUsername() {
    if (!process.env.GH_TOKEN) {
        return data.githubUsername;
    }

    try {
        const response = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${process.env.GH_TOKEN}`,
            },
            signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS),
        });

        if (!response.ok) {
            return data.githubUsername;
        }

        const profile = await response.json();
        return profile.login || data.githubUsername;
    } catch {
        return data.githubUsername;
    }
}

const githubUsername = await getGitHubUsername();

/** @type {import('next').NextConfig} */
const nextConfig = {
    pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
    experimental: {
        // Caching all page.jsx files on the client for 5 minutes.
        // Resulting in immediate navigation and no loading time.
        staleTimes: {
            dynamic: 300,
            static: 300
        }
    },
    env: {
        /** GitHub username loaded in build time. */
        GITHUB_USERNAME: githubUsername,
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**.githubusercontent.com' },
            { protocol: 'https', hostname: '**.github.com' }
        ],
    },
    async headers() {
        const publicAssetCache = {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
        };

        return [
            {
                source: "/favicon.ico",
                headers: [publicAssetCache],
            },
            {
                source: "/:asset*.svg",
                headers: [publicAssetCache],
            },
        ];
    },
};

export default (nextConfig);
