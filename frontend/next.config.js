/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    let backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    
    // Ensure backend URL has a protocol
    if (backendUrl && !backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
      // If no protocol, assume https for production URLs, http for localhost
      if (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
        backendUrl = `http://${backendUrl}`;
      } else {
        backendUrl = `https://${backendUrl}`;
      }
    }
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${backendUrl}/auth/:path*`,
      },
    ];
  },
}

module.exports = nextConfig

