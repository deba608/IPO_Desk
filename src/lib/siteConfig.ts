/**
 * siteConfig.ts — Single source of truth for the site URL and brand identity.
 *
 * Priority:
 *  1. NEXT_PUBLIC_SITE_URL env var (set this in Vercel settings if you
 *     ever add a custom domain, e.g. https://ipodesk.com)
 *  2. Falls back to the live Vercel deployment URL automatically
 *
 * Usage: import { siteUrl, siteName, siteAlternateName } from "@/lib/siteConfig";
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://ipo-desk.vercel.app";

/** Canonical brand name used in metadata, JSON-LD, and Open Graph. */
export const siteName = "IPO Desk";

/**
 * Alternate brand name — the no-hyphen form users type in Google.
 * Referenced in Organization JSON-LD so Google indexes it as a brand alias.
 */
export const siteAlternateName = "IPODESK";
