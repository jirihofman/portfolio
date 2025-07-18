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
        /** GitHub username loaded from environment variable. */
        GITHUB_USERNAME: process.env.GITHUB_USERNAME || 'octocat',
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**.githubusercontent.com' },
            { protocol: 'https', hostname: '**.github.com' }
        ],
    },
};

export default (nextConfig);
