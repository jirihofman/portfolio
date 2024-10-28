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
        GITHUB_USERNAME: await fetch('https://api.github.com/user',
            {
                headers: {
                    Authorization: `token ${process.env.GH_TOKEN}`,
                },
                next: {
                    // No revalidation needed. It is fine to get it on build time and use it forever.
                    tags: ['github', 'github-username'],
                }
            }
        ).then(res => res.json()).then(data => data.login),
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**.githubusercontent.com' },
            { protocol: 'https', hostname: '**.github.com' },
            { protocol: 'https', hostname: 'turbo.build' }
        ],
    },
};

export default (nextConfig);
