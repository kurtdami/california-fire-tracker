/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['incidents.fire.ca.gov'],
  },
  distDir: '.next',
  // Ensure output is handled correctly for Vercel
  output: 'standalone',
};

module.exports = nextConfig;
