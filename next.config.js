/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['incidents.fire.ca.gov'],
  },
  // Enable serverless functions
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
