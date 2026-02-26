import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/middleware-manifest\.json$/], // CRITICAL: Prevents Vercel WorkerError crash
  publicExcludes: ["!robots.txt", "!sitemap.xml"],
  fallbacks: {
    document: "/offline.html",
  },
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "supabase-api",
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 5 },
      },
    },
    {
      urlPattern: /\.(?:js|css|woff2?)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Next.js 16 defaults to Turbopack — empty config silences the webpack conflict from next-pwa
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "supabase.atmando.app",
      },
      {
        protocol: "https",
        hostname: "hltuqxtemjpwfwjolyey.supabase.co",
      },
    ],
  },
  // Allow larger file uploads for PDF sources (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default withPWA(nextConfig);
