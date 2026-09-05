import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by the Dockerfile, which serves .next/standalone/server.js.
  output: "standalone",
  // Pin the workspace root: a stray package-lock.json in a parent directory
  // makes Turbopack infer the wrong root (wrong file watching / env loading).
  turbopack: {
    root: __dirname,
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
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

