/** @type {import('next').NextConfig} */
const nextConfig = {
	pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
	experimental: {
		// mdxRs: true,
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
			{ protocol: 'https', hostname: '**.github.com' }
		],
	},
};

export default (nextConfig);
