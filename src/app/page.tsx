/**
 * page.tsx — Server Component wrapper for the homepage.
 *
 * WHY THIS EXISTS:
 * The real homepage UI (client-page.tsx) is "use client". That means Google
 * crawlers receive a blank page on first load — zero readable content, zero
 * ranking signals. This server wrapper:
 *   1. Renders an SEO-visible <h1>, intro copy, and JSON-LD schema that Google
 *      reads instantly without executing JavaScript.
 *   2. Lazy-loads the full interactive checker after hydration (no UX change).
 */
import Script from "next/script";
import { siteUrl } from "@/lib/siteConfig";
import ClientPageLoader from "./client-page-loader";

// JSON-LD: WebSite schema (enables Google Sitelinks Search Box)
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "IPO Desk",
  url: siteUrl,
  description:
    "India's smartest IPO research and allotment platform. Check allotment status, live GMP, subscription data, AI research reports and IPO calendar.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/?ipo={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

// JSON-LD: WebApplication schema (helps Google understand this is a finance tool)
// NOTE: single source of truth — client-page.tsx must NOT inject a second
// WebApplication block. No aggregateRating here: ratings without visible
// on-page reviews risk a Google spam penalty.
const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "IPO Desk",
  url: siteUrl,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
  },
  description:
    "Free IPO allotment checker supporting KFintech, Link Intime, Bigshare and MUFG registrars. Bulk PAN check, Excel upload, live GMP, IPO calendar and AI-powered research reports.",
  featureList: [
    "IPO Allotment Status Checker",
    "Bulk PAN Upload via Excel",
    "Live Grey Market Premium (GMP)",
    "IPO Calendar — Upcoming, Open, Listed",
    "AI Research Reports & Investment Score",
    "IPO Strategy Backtesting Engine",
  ],
  inLanguage: "en-IN",
  audience: {
    "@type": "Audience",
    geographicArea: {
      "@type": "Country",
      name: "India",
    },
  },
};

export default function HomePage() {
  return (
    <>
      {/* ── Structured Data ─────────────────────────────────────── */}
      <Script
        id="schema-website"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <Script
        id="schema-webapp"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />

      {/*
        * SEO hero content — visible, crawlable section with the single H1.
        * Renders ABOVE the interactive client UI so Google reads real copy
        * without executing JavaScript. The interactive heading in
        * client-page.tsx uses an <h2> styled identically.
        */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/5 via-background to-background px-4 py-10 sm:py-14">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            India&apos;s #1 Free IPO Platform · IPODESK
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            IPO Allotment Status Check —{" "}
            <span className="gradient-text">Free PAN Checker</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Check IPO allotment status instantly using your PAN number. IPO Desk (IPODESK) supports
            all major Indian registrars: KFintech, Link Intime, Bigshare, and MUFG. Upload an Excel
            file for bulk PAN checking across hundreds of applicants in seconds.
          </p>
          <nav aria-label="Key features" className="mt-6 flex flex-wrap gap-3">
            <a
              href="/calendar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              📅 IPO Calendar 2026
            </a>
            <a
              href="/ipo-allotment-check"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              ✅ How to Check Allotment
            </a>
            <a
              href="/ipo-gmp-today"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              📈 IPO GMP Today
            </a>
            <a
              href="/upcoming-ipo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              🚀 Upcoming IPOs
            </a>
            <a
              href="/apply"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              👨‍👩‍👧 Family IPO Checklist
            </a>
            <a
              href="/backtest"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              🔬 Strategy Backtesting
            </a>
          </nav>
        </div>
      </section>

      {/* ── Full interactive homepage UI (client-side) ───────────── */}
      <ClientPageLoader />
    </>
  );
}
