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
        * SEO content — sr-only: invisible to users, crawlable by Google.
        * The H1 and internal links are real DOM content that search engines read.
        * The interactive hero in client-page.tsx uses an <h2>.
        */}
      <div className="sr-only">
        <h1>IPO Allotment Status Check — Free PAN Checker for Indian IPOs</h1>
        <p>
          Check IPO allotment status instantly using your PAN number. IPO Desk (IPODESK) supports
          all major Indian registrars: KFintech, Link Intime, Bigshare, and MUFG. Upload an Excel
          file for bulk PAN checking across hundreds of applicants in seconds.
        </p>
        <nav aria-label="Key features">
          <ul>
            <li><a href="/calendar">IPO Calendar 2026 — Upcoming &amp; Open IPOs</a></li>
            <li><a href="/ipo-allotment-check">How to Check IPO Allotment Status by PAN</a></li>
            <li><a href="/ipo-gmp-today">IPO GMP Today — Live Grey Market Premium</a></li>
            <li><a href="/upcoming-ipo">Upcoming IPO India 2026 — Full Schedule</a></li>
            <li><a href="/apply">Family IPO Checklist — Track Bids Across Accounts</a></li>
            <li><a href="/backtest">IPO Strategy Backtesting Engine</a></li>
          </ul>
        </nav>
      </div>

      {/* ── Full interactive homepage UI (client-side) ───────────── */}
      <ClientPageLoader />
    </>
  );
}
