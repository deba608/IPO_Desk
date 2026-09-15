import type { MetadataRoute } from "next";
import { getCalendar } from "@/features/ipo-calendar/lib/calendar.service";
import { siteUrl } from "@/lib/siteConfig";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/calendar`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/apply`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/backtest`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Dynamic IPO detail pages — one entry per enriched IPO
  let dynamicRoutes: MetadataRoute.Sitemap = [];
  try {
    const { ipos } = await getCalendar();
    dynamicRoutes = ipos.map((ipo) => ({
      url: `${siteUrl}/ipo/${ipo.id}`,
      // Real freshness signal: prefer subscription/GMP timestamps over "now"
      // so Google doesn't learn to ignore our lastModified.
      lastModified: new Date(
        ipo.subscription?.updatedAt ?? ipo.gmpUpdatedAt ?? ipo.listingDate ?? ipo.closeDate ?? Date.now()
      ),
      // Open IPOs change frequently; listed ones are stable
      changeFrequency:
        ipo.lifecycle === "open"
          ? ("hourly" as const)
          : ipo.lifecycle === "upcoming"
          ? ("daily" as const)
          : ("weekly" as const),
      priority:
        ipo.lifecycle === "open" ? 0.95 : ipo.lifecycle === "upcoming" ? 0.85 : 0.6,
    }));
  } catch {
    // If catalogue fails (e.g. during static build), fall back gracefully
    dynamicRoutes = [];
  }

  return [...staticRoutes, ...dynamicRoutes];
}
