/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'dist',
  images: {
    domains: ['incidents.fire.ca.gov'],
  },
};

module.exports = nextConfig;
