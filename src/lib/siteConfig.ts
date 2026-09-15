/**
 * siteConfig.ts — Single source of truth for the site URL.
 *
 * Priority:
 *  1. NEXT_PUBLIC_SITE_URL env var (set this in Vercel settings if you
 *     ever add a custom domain, e.g. https://ipodesk.com)
 *  2. Falls back to the live Vercel deployment URL automatically
 *
 * Usage: import { siteUrl } from "@/lib/siteConfig";
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://ipo-desk.vercel.app";
