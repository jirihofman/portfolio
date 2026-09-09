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

        const securityHeaders = [
            { key: "X-Frame-Options", value: "DENY" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
            { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' https: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'" },
        ];

        return [
            {
                source: "/:path*",
                headers: securityHeaders,
            },
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
