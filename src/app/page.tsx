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
import dynamic from "next/dynamic";
import Script from "next/script";
import { siteUrl } from "@/lib/siteConfig";

// Lazy-load the interactive client component — it's heavy (bulk checker,
// Excel upload) and Google doesn't need it for indexing.
const ClientPage = dynamic(() => import("./client-page"), { ssr: false });

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
       * SEO-only hero content — visually hidden from interactive users but
       * fully readable by Google crawlers. The actual interactive UI is
       * rendered by ClientPage below.
       *
       * Uses sr-only (screen-reader / crawler visible, not visually intrusive)
       * because the ClientPage already shows a beautiful UI. We want Google to
       * read meaningful text without duplicating content on screen.
       */}
      <div className="sr-only">
        <h1>IPO Desk — Free IPO Allotment Checker & Research Platform for Indian Investors</h1>
        <p>
          Check IPO allotment status instantly using your PAN number. IPO Desk supports all major
          Indian registrars: KFintech, Link Intime, Bigshare, and MUFG. Upload an Excel file for
          bulk PAN checking across hundreds of applicants in seconds.
        </p>
        <p>
          Beyond allotment checking, IPO Desk provides live Grey Market Premium (GMP) data, a
          comprehensive IPO calendar tracking upcoming, open, closed, and listed IPOs, AI-generated
          research reports with investment scores, subscription status (QIB, NII, Retail), and a
          unique IPO strategy backtesting engine.
        </p>
        <nav aria-label="Main features">
          <ul>
            <li>
              <a href="/calendar">IPO Calendar — Upcoming &amp; Open IPOs 2026</a>
            </li>
            <li>
              <a href="/backtest">IPO Strategy Backtesting Engine</a>
            </li>
          </ul>
        </nav>
      </div>

      {/* ── Full interactive homepage UI (client-side) ───────────── */}
      <ClientPage />
    </>
  );
}
