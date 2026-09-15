import type { Metadata } from "next";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { Header } from "@/components/common/Header";
import { ApplyWorkspace } from "@/features/ipo-apply/components/ApplyWorkspace";

export const metadata: Metadata = {
  title: "Apply for IPO from Multiple Accounts — IPO Desk",
  description:
    "Apply for the same IPO from all family accounts in one flow: save PANs + brokers + UPI IDs once, copy details, jump to each broker's IPO page, and track UPI mandates.",
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
              <span>Multi-account apply</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Apply from all accounts, <span className="gradient-text">one flow</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              We prepare everything — you approve each bid in your broker + UPI app.
              No website can skip that step (SEBI requires broker login + UPI mandate approval per PAN).
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
