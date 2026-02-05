/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    // Use localhost for local dev, backend-api for Docker
    const apiHost = process.env.NODE_ENV === 'development' ? 'localhost:4000' : 'backend-api:4000';

    return [
      {
        source: '/api/v1/:path*',
        destination: `http://${apiHost}/api/v1/:path*`, // Proxy to Backend API
      },
      {
        source: '/api/market/:path*',
        destination: `http://${apiHost}/api/market/:path*`, // Market/Analysis API
      },
      {
        source: '/api/backfill/:path*',
        destination: `http://${apiHost}/api/backfill/:path*`, // Backfill routes
      },
      {
        source: '/grafana/:path*',
        destination: 'http://grafana:3000/grafana/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
