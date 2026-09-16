import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";
import { IPOCalendarView } from "@/features/ipo-calendar/components/IPOCalendarView";
import { Header } from "@/components/common/Header";
import { siteUrl } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "IPO Calendar 2026 — Upcoming, Open, Closed & Listed IPOs India",
  description:
    "Track all mainboard and SME IPOs in India for 2026: upcoming, open, closed and recently listed. Price band, lot size, issue size, dates, registrar, lead managers and live GMP at a glance.",
  keywords: [
    "IPO calendar 2026",
    "upcoming IPO India",
    "open IPO today",
    "IPO listing date",
    "mainboard IPO calendar",
    "SME IPO calendar",
    "IPO GMP today",
    "IPO allotment date",
    "new IPO India 2026",
    "IPO subscription status",
  ],
  alternates: {
    canonical: `${siteUrl}/calendar`,
    languages: { "en-IN": `${siteUrl}/calendar` },
  },
  openGraph: {
    title: "IPO Calendar 2026 — All Indian IPOs in One Place",
    description:
      "Live IPO calendar: track upcoming, open, closed & listed mainboard and SME IPOs with GMP, subscription data, price band, lot size and listing dates.",
    url: `${siteUrl}/calendar`,
    images: [{ url: `${siteUrl}/og-banner.jpg`, width: 1200, height: 630, alt: "IPO Desk Calendar" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IPO Calendar 2026 — All Indian IPOs",
    description: "Live IPO calendar with GMP, subscription & listing dates for all mainboard & SME IPOs.",
    images: [`${siteUrl}/og-banner.jpg`],
  },
};

export default function CalendarPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Page heading */}
        <section className="relative overflow-hidden px-4 py-12 sm:py-16">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="relative container mx-auto max-w-6xl">
            <div className="flex items-center gap-2 text-sm text-primary">
              <CalendarRange className="h-4 w-4" />
              <span>IPO Calendar</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Every IPO, <span className="gradient-text">one calendar</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground">
              Upcoming, open, closed and recently listed mainboard &amp; SME issues —
              with price band, lot size, dates, registrar and grey-market premium.
            </p>
            <nav aria-label="Related IPO pages" className="mt-5 flex flex-wrap gap-2">
              <a href="/upcoming-ipo" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                🚀 Upcoming IPOs
              </a>
              <a href="/ipo-gmp-today" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                📈 IPO GMP Today
              </a>
              <a href="/ipo-allotment-check" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                ✅ How to Check Allotment
              </a>
              <a href="/apply" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                👨‍👩‍👧 Family Checklist
              </a>
            </nav>
          </div>
        </section>

        {/* Calendar */}
        <section className="container mx-auto max-w-6xl px-4 pb-4">
          <IPOCalendarView />
        </section>
      </main>

      <footer className="border-t border-border py-3">
        <div className="container mx-auto flex flex-col items-center px-4 sm:flex-row">
          <div className="hidden flex-1 sm:block" />
          <p className="text-xs text-muted-foreground sm:text-sm">
            Crafted with ❤️ by Dev
          </p>
          <div className="flex-1 text-center sm:text-right">
            <p className="text-xs text-muted-foreground sm:text-sm">
              © 2026 IPO Desk. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
