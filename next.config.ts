import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
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

export default withPWA({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
  publicExcludes: ["!robots.txt", "!sitemap.xml"],
  fallbacks: {
    document: "/offline.html",
  },
  workboxOptions: {
    skipWaiting: true,
    // CRITICAL: Prevents Vercel WorkerError crash (was buildExcludes in old next-pwa)
    exclude: [/middleware-manifest\.json$/],
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
  },
})(nextConfig);
