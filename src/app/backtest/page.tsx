import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Header } from "@/components/common/Header";
import { siteUrl } from "@/lib/siteConfig";

// recharts is heavy — split it off the initial page bundle; the workspace
// (and its charts) loads right after.
const BacktestWorkspace = dynamic(
  () =>
    import("@/features/backtest/components/BacktestWorkspace").then(
      (m) => m.BacktestWorkspace
    ),
  { loading: () => <p className="py-10 text-center text-sm text-muted-foreground">Loading backtest engine…</p> }
);

export const metadata: Metadata = {
  title: "IPO Strategy Backtesting Engine — Quantitative Rules & Historical Returns",
  description:
    "Test your IPO bidding strategies against verified historical data. Analyse win rates, listing day gains, and subscription filters for Indian mainboard & SME IPOs from 2023–2026.",
  keywords: [
    "IPO backtesting",
    "IPO strategy simulator",
    "IPO listing gain calculator",
    "IPO win rate India",
    "GMP based IPO strategy",
    "QIB subscription IPO filter",
    "IPO historical returns India",
    "mainboard SME IPO analysis",
  ],
  alternates: {
    canonical: `${siteUrl}/backtest`,
    languages: { "en-IN": `${siteUrl}/backtest` },
  },
  openGraph: {
    title: "IPO Strategy Backtesting Engine — IPO Desk",
    description:
      "Backtest IPO strategies against real Indian IPO data. Win rates, listing gains & subscription filters.",
    url: `${siteUrl}/backtest`,
    images: [{ url: `${siteUrl}/og-banner.jpg`, width: 1200, height: 630, alt: "IPO Desk Backtesting" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IPO Strategy Backtesting Engine — IPO Desk",
    description: "Simulate your IPO bidding strategy against 2023–2026 Indian IPO data.",
    images: [`${siteUrl}/og-banner.jpg`],
  },
};

export default function BacktestPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* SSR heading — the single H1. The workspace banner heading is an
            H2 styled identically so crawlers get content without JS. */}
        <div className="sr-only">
          <h1>IPO Strategy Backtesting Engine — Test Listing-Day Rules on Historical Data</h1>
          <p>
            Simulate quantitative IPO bidding strategies against verified Indian mainboard and SME
            IPO data from 2023–2026. Filter by GMP, QIB and retail subscription to find
            high win-rate rules before bidding.
          </p>
        </div>
        <BacktestWorkspace />
      </main>
      <footer className="border-t border-border py-4">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            © 2026 IPO Desk · Past performance is simulated on verified historical closing and listing figures, not financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
