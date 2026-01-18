/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://backend-api:4000/api/v1/:path*', // Proxy to Backend API
      },
      {
        source: '/grafana/:path*',
        destination: 'http://grafana:3000/grafana/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
