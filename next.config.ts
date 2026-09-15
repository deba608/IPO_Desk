import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by the Dockerfile, which serves .next/standalone/server.js.
  output: "standalone",
  // Pin the workspace root: a stray package-lock.json in a parent directory
  // makes Turbopack infer the wrong root (wrong file watching / env loading).
  turbopack: {
    root: __dirname,
  },
  // Gzip/Brotli compress all responses (default true, explicit for clarity)
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
          // Cache static assets aggressively
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Don't cache HTML pages — always fresh
      {
        source: "/:path((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

