/** @type {import('next').NextConfig} */
const nextConfig = {
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "X-Robots-Tag",
						value: "index, follow",
					},
				],
			},
		];
	},
	async redirects() {
		return [
			{
				source: "/search",
				has: [{ type: "query", key: "q" }],
				destination: "/search/:q",
				permanent: true,
			},
			{
				source: "/:path*",
				has: [
					{
						type: "host",
						value: "^topic-breakdown\\.com$",
					},
				],
				destination: "https://www.topic-breakdown.com/:path*",
				permanent: true,
			}
		];
	},
};

export default nextConfig;
