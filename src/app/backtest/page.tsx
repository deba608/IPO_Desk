import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Header } from "@/components/common/Header";

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
    "Test your IPO bidding strategies against verified historical data. Analyze win rates, listing day gains, and subscription filters for Indian mainboard & SME IPOs.",
};

export default function BacktestPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-6 sm:px-6">
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
