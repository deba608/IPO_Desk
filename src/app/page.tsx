"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Shield,
  Zap,
  Users,
  CheckCircle2,
  BarChart3,
  Upload,
  FileSpreadsheet,
  ScanSearch,
  Target,
  TrendingUp,
  Activity,
  Calendar,
} from "lucide-react";
import { IPOSelector } from "@/features/ipo-checker/components/IPOSelector";
import { CheckerTabs } from "@/features/ipo-checker/components/CheckerTabs";
import { ResultsDashboard } from "@/features/ipo-checker/components/ResultsDashboard";
import { ScanResultsDashboard } from "@/features/ipo-checker/components/ScanResultsDashboard";
import { CheckResponse, ScanResponse } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { Header } from "@/components/common/Header";
import { useCheckHistory } from "@/hooks/useCheckHistory";
import type { CalendarIPOWithStatus } from "@/types/calendar.types";

/* ------------------------------------------------------------------ */
/*  Live Ticker Strip                                                   */
/* ------------------------------------------------------------------ */

function LiveTicker({ ipos }: { ipos: CalendarIPOWithStatus[] }) {
  const open = ipos.filter((i) => i.lifecycle === "open");
  if (open.length === 0) return null;

  // Duplicate the list so the CSS marquee loops seamlessly
  const items = [...open, ...open];

  return (
    <div className="relative overflow-hidden border-y border-primary/10 bg-primary/[0.03] py-2">
      <div className="flex" style={{ width: "max-content" }}>
        <div
          className="animate-ticker flex shrink-0 items-center gap-6 pr-6"
          style={{ animationDuration: `${Math.max(open.length * 6, 24)}s` }}
        >
          {items.map((ipo, idx) => {
            const hasGmp = ipo.gmp !== undefined && ipo.gmp !== null;
            const gmpPositive = hasGmp && (ipo.gmp as number) >= 0;
            return (
              <a
                key={`${ipo.id}-${idx}`}
                href={`/ipo/${ipo.id}`}
                className="flex items-center gap-2 whitespace-nowrap text-[11px] hover:opacity-80 transition-opacity"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-medium text-foreground/80">{ipo.name}</span>
                {hasGmp && (
                  <span
                    className={`font-bold tabular-nums ${gmpPositive ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    GMP {gmpPositive ? "+" : ""}₹{ipo.gmp}
                  </span>
                )}
                <span className="text-muted-foreground/50">·</span>
              </a>
            );
          })}
        </div>
      </div>
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats Bar                                                           */
/* ------------------------------------------------------------------ */

function StatsBar({ ipos }: { ipos: CalendarIPOWithStatus[] }) {
  const openCount = ipos.filter((i) => i.lifecycle === "open").length;
  const upcomingCount = ipos.filter((i) => i.lifecycle === "upcoming").length;
  const withGmp = ipos.filter((i) => i.gmp !== undefined && i.gmp !== null);
  const topGmp =
    withGmp.length > 0
      ? withGmp.reduce((best, cur) =>
          (cur.gmp as number) > (best.gmp as number) ? cur : best
        )
      : null;

  const stats = [
    {
      icon: Activity,
      label: "IPOs Open Now",
      value: openCount,
      color: "text-emerald-400",
    },
    {
      icon: Calendar,
      label: "Upcoming",
      value: upcomingCount,
      color: "text-blue-400",
    },
    {
      icon: TrendingUp,
      label: "Top GMP",
      value: topGmp ? `+₹${topGmp.gmp}` : "—",
      sub: topGmp ? topGmp.name.split(" ").slice(0, 2).join(" ") : "",
      color: "text-amber-400",
    },
  ];

  return (
    <div className="animate-fade-up delay-300 container mx-auto max-w-4xl px-4 pb-4">
      <div className="grid grid-cols-3 divide-x divide-border/40 rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm">
        {stats.map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="flex items-center gap-3 px-5 py-3">
            <div className={`shrink-0 rounded-lg bg-primary/10 p-1.5`}>
              <Icon className={`h-3.5 w-3.5 ${color}`} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
              {sub && <p className="truncate text-[9px] text-muted-foreground/70">{sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Home Page                                                           */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [selectedIPO, setSelectedIPO] = useState<IPO | null>(null);
  const [scanMode, setScanMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CheckResponse | null>(null);
  const [scanResults, setScanResults] = useState<ScanResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const checkerRef = useRef<HTMLDivElement>(null);
  const { add: addHistory } = useCheckHistory();

  // Live calendar data for the ticker + stats bar
  const [calendarIPOs, setCalendarIPOs] = useState<CalendarIPOWithStatus[]>([]);
  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((json: { ipos?: CalendarIPOWithStatus[] }) => {
        if (Array.isArray(json.ipos)) setCalendarIPOs(json.ipos);
      })
      .catch(() => {});
  }, []);

  const handleCheck = useCallback(
    async (pans: string[]) => {
      if (!scanMode && !selectedIPO) {
        toast.error("Please select an IPO first");
        return;
      }

      if (pans.length === 0) {
        toast.error("Please enter at least one PAN");
        return;
      }

      if (scanMode && pans.length > 50) {
        toast.error("Scan mode supports up to 50 PANs at a time.");
        return;
      }

      setIsLoading(true);
      setProgress(10);

      try {
        // Simulate progress (scans across many IPOs are slower — ramp gently)
        const progressInterval = setInterval(() => {
          setProgress((p) => Math.min(p + (scanMode ? 2 : 5), 85));
        }, 300);

        const response = await fetch(scanMode ? "/api/scan" : "/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            scanMode
              ? { pans }
              : {
                  pans,
                  // Namespaced id so the backend resolves the right registrar even
                  // when two registrars reuse the same numeric clientId
                  ipoClientId: selectedIPO!.id,
                }
          ),
        });

        clearInterval(progressInterval);
        setProgress(100);

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error ?? "Check failed");
        }

        const data = await response.json();

        if (scanMode) {
          const scan = data as ScanResponse;
          setScanResults(scan);
          setResults(null);

          addHistory({
            type: "scan",
            label: `${scan.scanned} IPOs`,
            pansChecked: scan.pansChecked,
            allotted: scan.iposWithAllotment,
            total: scan.scanned,
            appliedTo: scan.ipos.length,
          });

          if (scan.iposWithAllotment > 0) {
            toast.success(
              `Allotment found in ${scan.iposWithAllotment} IPO${
                scan.iposWithAllotment === 1 ? "" : "s"
              }! Scanned ${scan.scanned} active IPOs.`,
              { duration: 5000 }
            );
          } else if (scan.ipos.length > 0) {
            toast.info(
              `Applied to ${scan.ipos.length} IPO${
                scan.ipos.length === 1 ? "" : "s"
              }, no allotments yet.`,
              { duration: 4000 }
            );
          } else {
            toast.info(
              `Scan complete: no applications found across ${scan.scanned} IPOs.`,
              { duration: 4000 }
            );
          }
        } else {
          const check = data as CheckResponse;
          setScanResults(null);
          setResults(check);

          addHistory({
            type: "check",
            label: check.ipoName,
            registrar: selectedIPO?.registrar,
            pansChecked: check.summary.total,
            allotted: check.summary.allotted,
            total: check.summary.total,
          });

          if (check.summary.allotted > 0) {
            toast.success(
              `Allotment confirmed: ${check.summary.allotted} of ${check.summary.total} PANs were allotted.`,
              { duration: 5000 }
            );
          } else {
            toast.info(
              `Check complete: ${check.summary.total} PANs checked. No allotments found.`,
              { duration: 4000 }
            );
          }
        }

        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : "Something went wrong";
        toast.error(msg);
      } finally {
        setIsLoading(false);
        setTimeout(() => setProgress(0), 1000);
      }
    },
    [selectedIPO, scanMode, addHistory]
  );

  const scrollToChecker = useCallback(() => {
    checkerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "IPO Desk — IPO Allotment Checker",
            url: "https://ipodesk.com",
            description:
              "Check IPO allotment status for single or multiple PANs instantly. Free IPO allotment checker supporting KFintech IPOs.",
            applicationCategory: "FinanceApplication",
            operatingSystem: "All",
            browserRequirements: "Modern browser with JavaScript enabled",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "INR",
            },
            featureList: [
              "Single PAN check",
              "Bulk PAN check",
              "Excel file upload",
              "CSV/Excel export",
            ],
          }),
        }}
      />
      <Header />

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 py-20">
          {/* Animated background blobs */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="absolute inset-0 pointer-events-none">
            <div className="animate-blob absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
            <div className="animate-blob-2 absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
            <div
              className="animate-blob absolute left-1/2 bottom-10 h-48 w-48 rounded-full bg-violet-500/8 blur-3xl"
              style={{ animationDelay: "-8s" }}
            />
          </div>

          <div className="relative container mx-auto max-w-5xl text-center">
            {/* Title */}
            <h1 className="animate-fade-up mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Check IPO Allotment
              <span className="block gradient-text">in Seconds</span>
            </h1>

            <p className="animate-fade-up delay-100 mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
              Check allotment status for single or multiple PANs instantly.
              Upload Excel files for bulk checking. Export results to CSV or
              Excel.
            </p>

            {/* Feature pills — staggered entrance */}
            <div className="mb-12 flex flex-wrap justify-center gap-3">
              {[
                { icon: Shield, text: "Secure & Private", delay: "delay-150" },
                { icon: Zap, text: "Instant Results", delay: "delay-200" },
                { icon: Users, text: "Bulk Processing", delay: "delay-250" },
                { icon: FileSpreadsheet, text: "Excel Upload", delay: "delay-300" },
              ].map(({ icon: Icon, text, delay }) => (
                <div
                  key={text}
                  className={`animate-fade-up ${delay} flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm`}
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live ticker strip */}
        {calendarIPOs.length > 0 && <LiveTicker ipos={calendarIPOs} />}

        {/* Stats bar */}
        {calendarIPOs.length > 0 && (
          <div className="pt-4">
            <StatsBar ipos={calendarIPOs} />
          </div>
        )}

        {/* Main Checker Card */}
        <section
          ref={checkerRef}
          className="container mx-auto max-w-4xl px-4 pb-8"
        >
          <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
            {/* Card Header */}
            <div className="border-b border-border px-8 py-6">
              <h2 className="text-xl font-semibold">Check Allotment Status</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an IPO, enter PAN number(s), and check your allotment status
              </p>
            </div>

            {/* Mode toggle: single IPO vs scan all active IPOs */}
            <div className="px-8 pt-6">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-1">
                <button
                  type="button"
                  onClick={() => setScanMode(false)}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    !scanMode
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Target className="h-4 w-4" />
                  Single IPO
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode(true)}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    scanMode
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ScanSearch className="h-4 w-4" />
                  Scan All IPOs
                </button>
              </div>
            </div>

            {/* IPO Selector — hidden in scan mode */}
            {!scanMode && (
              <div className="px-8 py-6 border-b border-border">
                <IPOSelector value={selectedIPO} onChange={setSelectedIPO} />
              </div>
            )}

            {/* Input Tabs */}
            <div className="px-8 py-6">
              <CheckerTabs
                onCheck={handleCheck}
                isLoading={isLoading}
                progress={progress}
                selectedIPO={selectedIPO}
                scanMode={scanMode}
              />
            </div>
          </div>
        </section>

        {/* Results Section */}
        {(results || scanResults) && (
          <section
            ref={resultsRef}
            className="container mx-auto max-w-6xl px-4 pb-16"
          >
            {scanResults ? (
              <ScanResultsDashboard results={scanResults} onCheckAgain={scrollToChecker} />
            ) : (
              results && <ResultsDashboard results={results} onCheckAgain={scrollToChecker} />
            )}
          </section>
        )}

        {/* How It Works */}
        {!results && !scanResults && (
          <section className="container mx-auto max-w-5xl px-4 pb-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold">How It Works</h2>
              <p className="mt-2 text-muted-foreground">3 simple steps to check your IPO allotment</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "01",
                  icon: BarChart3,
                  title: "Select IPO",
                  desc: "Choose from active IPOs across KFintech, MUFG, and Bigshare registrars",
                },
                {
                  step: "02",
                  icon: Upload,
                  title: "Enter PAN(s)",
                  desc: "Enter a single PAN, paste multiple, or upload an Excel file",
                },
                {
                  step: "03",
                  icon: CheckCircle2,
                  title: "Get Results",
                  desc: "Instantly see allotment status with export options",
                },
              ].map(({ step, icon: Icon, title, desc }) => (
                <div
                  key={step}
                  className="relative rounded-xl border border-border bg-card p-6 hover:border-primary/50 transition-colors"
                >
                  <div className="absolute top-4 right-4 text-4xl font-bold text-primary/10">
                    {step}
                  </div>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-2 font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © 2026 IPO Desk. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
