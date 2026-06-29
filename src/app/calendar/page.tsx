import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";
import { IPOCalendarView } from "@/features/ipo-calendar/components/IPOCalendarView";
import { Header } from "@/components/common/Header";

export const metadata: Metadata = {
  title: "IPO Calendar — Upcoming, Open, Closed & Listed IPOs",
  description:
    "Track all mainboard and SME IPOs in India: upcoming, open, closed and recently listed. Price band, lot size, issue size, dates, registrar, lead managers and GMP at a glance.",
  alternates: { canonical: "https://ipodesk.com/calendar" },
};

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
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
          </div>
        </section>

        {/* Calendar */}
        <section className="container mx-auto max-w-6xl px-4 pb-20">
          <IPOCalendarView />
        </section>
      </main>

      <footer className="border-t border-border py-6 sm:py-8">
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
