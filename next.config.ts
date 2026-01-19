import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true, // Force Gzip compression (Vercel Edge upgrades to Brotli)
  poweredByHeader: false, // Security: Hide Next.js tag
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Alt-Svc',
            value: 'h3=":443"; ma=86400', // Advertise HTTP/3 support
          },
          {
            key: 'X-Network-Quality-Target',
            value: '3g', // Custom header for debugging/tracking
          }
        ],
      },
    ];
  },
};

export default nextConfig;
