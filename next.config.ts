import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by the Dockerfile, which serves .next/standalone/server.js.
  output: "standalone",
  // Don't leak the framework name — minor security + SEO hygiene.
  poweredByHeader: false,
  // Pin the workspace root: a stray package-lock.json in a parent directory
  // makes Turbopack infer the wrong root (wrong file watching / env loading).
  turbopack: {
    root: __dirname,
  },
  // Gzip/Brotli compress all responses
  compress: true,
  // Tree-shake heavy icon / UI packages — cuts unused JS by 100-200 KiB
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-tabs",
      "recharts",
      "sonner",
    ],
  },
  async headers() {
    return [
      {
        // Long-lived cache for Next.js static assets (JS, CSS, fonts).
        // These are content-hashed so cache-busting is automatic.
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache static public files (icons, images) for 7 days.
        source: "/(favicon.ico|icon-.*\\.png|apple-icon-.*\\.png|og-banner\\.jpg|logo\\.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

