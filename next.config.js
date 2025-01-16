/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  distDir: '.next',
  images: {
    domains: ['incidents.fire.ca.gov'],
  },
};

module.exports = nextConfig;
