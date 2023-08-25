/** @type {import('next').NextConfig} */
const nextConfig = {
	pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
	experimental: {
		// TODO: remove when not experimental. Enable Turbopack then.
		serverActions: true,
		// mdxRs: true,
	},
	images: {
		domains: [
			"avatars.githubusercontent.com",
			"github.com",
			"raw.githubusercontent.com",
		],
	},
};

export default (nextConfig);
