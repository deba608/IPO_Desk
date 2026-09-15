import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteConfig";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Full access for major search engines
        userAgent: ["Googlebot", "Bingbot", "DuckDuckBot", "Slurp"],
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
        ],
      },
      {
        // Slow down generic crawlers to prevent scraping abuse
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
        ],
        crawlDelay: 2,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
