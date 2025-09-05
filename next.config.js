/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Keep linting in dev, but don't fail the Vercel build on lint errors
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;