/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    domains: ['incidents.fire.ca.gov'],
    unoptimized: true,
  },
};

module.exports = nextConfig;
