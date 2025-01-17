/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['incidents.fire.ca.gov'],
  },
  // Add headers configuration
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=60',
          },
          {
            key: 'Vercel-CDN-Cache-Control',
            value: 'public, s-maxage=3600',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=3600',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
