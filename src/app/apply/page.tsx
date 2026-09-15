import type { Metadata } from "next";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { Header } from "@/components/common/Header";
import { ApplyWorkspace } from "@/features/ipo-apply/components/ApplyWorkspace";
import { siteUrl } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Family IPO Checklist — Track Bids Across Accounts",
  description:
    "Don't miss a family bid: save PANs, brokers and UPI IDs once, apply in each broker's app, and track UPI mandates. One PAN = one bid (SEBI rule). Free family IPO checklist for Indian investors.",
  keywords: [
    "family IPO apply",
    "IPO checklist India",
    "multiple PAN IPO application",
    "UPI mandate track IPO",
    "IPO bid tracker",
  ],
  alternates: {
    canonical: `${siteUrl}/apply`,
    languages: { "en-IN": `${siteUrl}/apply` },
  },
  openGraph: {
    title: "Family IPO Checklist — Never Miss a Family Bid",
    description:
      "Save PANs + brokers + UPI IDs once, apply in each broker's app, and track UPI mandates across the family.",
    url: `${siteUrl}/apply`,
    images: [{ url: `${siteUrl}/og-banner.jpg`, width: 1200, height: 630, alt: "IPO Desk Family Checklist" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Family IPO Checklist — IPO Desk",
    description: "Track family IPO bids across PANs, brokers and UPI mandates in one checklist.",
    images: [`${siteUrl}/og-banner.jpg`],
  },
};

export default function ApplyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="px-4 py-10 sm:py-12">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Users className="h-4 w-4" />
              <span>Family checklist</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Don&apos;t miss a <span className="gradient-text">family bid</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              We don&apos;t place bids. We prevent missed / rejected bids — you still apply in each broker + approve UPI.
              One PAN = one bid (SEBI rule).
            </p>
            <div className="mt-6">
              <Suspense fallback={<p className="py-6 text-center text-xs text-muted-foreground">Loading workspace…</p>}>
                <ApplyWorkspace />
              </Suspense>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border py-3">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[10px] text-muted-foreground">© 2026 IPO Desk · Applying happens in your broker&apos;s app. We never move money.</p>
        </div>
      </footer>
    </div>
  );
}
