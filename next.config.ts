import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  disable: true, // process.env.NODE_ENV === "development",
  // customWorkerDir: "worker", // Removed to fix type error
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
  },
});

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
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

export default withPWA(nextConfig);
