"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ScanSearch,
  Target,
  SearchCode,
  Calendar,
} from "lucide-react";
import { IPOSelector } from "@/features/ipo-checker/components/IPOSelector";
import { CheckerTabs } from "@/features/ipo-checker/components/CheckerTabs";
import { ResultsDashboard } from "@/features/ipo-checker/components/ResultsDashboard";
import { ScanResultsDashboard } from "@/features/ipo-checker/components/ScanResultsDashboard";
import { RecentIPOsFeed } from "@/features/ipo-checker/components/RecentIPOsFeed";
import { CheckResponse, ScanResponse } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { Header } from "@/components/common/Header";
import { useCheckHistory } from "@/hooks/useCheckHistory";

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

      // Simulate progress (scans across many IPOs are slower — ramp gently).
      // Hoisted so the finally block can always clear it — a leaked interval
      // here re-rendered the page every 300ms forever.
      let progressInterval: ReturnType<typeof setInterval> | undefined;
      try {
        progressInterval = setInterval(() => {
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
          } else if (check.summary.notAllotted > 0) {
            toast.info(
              `Check complete: ${check.summary.notAllotted} of ${check.summary.total} PANs were not allotted.`,
              { duration: 4000 }
            );
          } else if (check.summary.notFound > 0) {
            toast.info(
              `Check complete: ${check.summary.notFound === 1 ? "This PAN was not applied" : `${check.summary.notFound} PANs were not applied`} for ${check.ipoName}.`,
              { duration: 4000 }
            );
          } else {
            toast.info(
              `Check complete: ${check.summary.total} PANs checked.`,
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
        if (progressInterval !== undefined) clearInterval(progressInterval);
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
    <div className="min-h-screen flex flex-col bg-background">
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

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 pt-16 pb-14 sm:pt-20 sm:pb-16">
          {/* Glow blobs */}
          <div className="pointer-events-none absolute left-1/4 top-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px] animate-blob" />
          <div className="pointer-events-none absolute right-1/4 top-8 h-[300px] w-[300px] rounded-full bg-blue-500/8 blur-[100px] animate-blob-2" />
          {/* Fade edges */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />

          <div className="relative container mx-auto max-w-5xl text-center">


            <h1 className="animate-fade-up delay-100 text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Check IPO Allotment
              <span className="block gradient-text mt-2 sm:mt-3">in Seconds</span>
            </h1>

            <p className="animate-fade-up delay-200 mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Enter your PAN and instantly check allotment status across every Indian registrar.
              No sign-ups, no fees.
            </p>

            {/* CTA */}
            <div className="animate-fade-up delay-300 mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={scrollToChecker}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.97]"
              >
                <SearchCode className="h-4 w-4" />
                Check Your Allotment
              </button>
              <Link
                href="/calendar"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-[0.97]"
              >
                <Calendar className="h-4 w-4" />
                Browse IPO Calendar
              </Link>
            </div>
          </div>
        </section>

        {/* Recent IPOs Feed */}
        <section className="container mx-auto max-w-4xl px-4 py-5">
          <RecentIPOsFeed
            onSelect={(ipo) => {
              setSelectedIPO(ipo);
              setScanMode(false);
              setTimeout(() => {
                checkerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 100);
            }}
          />
        </section>

        {/* Main Checker Card */}
        <section
          ref={checkerRef}
          className="container mx-auto max-w-4xl px-4 pb-8"
        >
          <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
            {/* Card Header */}
            <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Check Allotment Status</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select an IPO, enter PAN number(s), and check your allotment status
                </p>
              </div>

              {/* Mode toggle: single IPO vs scan all — one control, swiping highlight */}
              <div className="relative grid w-full grid-cols-2 rounded-xl border border-border bg-muted/30 p-0.5 sm:w-auto shrink-0">
                {/* Swiping highlight */}
                <span
                  aria-hidden
                  className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg border border-primary/60 bg-primary/10 shadow-md shadow-primary/10 transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${
                    scanMode ? "translate-x-full" : "translate-x-0"
                  }`}
                />
                {[
                  { active: !scanMode, onClick: () => setScanMode(false), Icon: Target, label: "Single IPO" },
                  { active: scanMode, onClick: () => setScanMode(true), Icon: ScanSearch, label: "Scan All IPOs" },
                ].map(({ active, onClick, Icon, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className={`relative z-10 flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-300 sm:px-5 ${
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                        active ? "scale-110" : "scale-100"
                      }`}
                    />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* IPO Selector — hidden in scan mode */}
            {!scanMode && (
              <div className="px-6 py-4 border-b border-border">
                <IPOSelector value={selectedIPO} onChange={setSelectedIPO} />
              </div>
            )}

            {/* Input Tabs */}
            <div className="px-6 py-4">
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
            className="container mx-auto max-w-6xl px-4 pb-4"
          >
            {scanResults ? (
              <ScanResultsDashboard results={scanResults} onCheckAgain={scrollToChecker} />
            ) : (
              results && <ResultsDashboard results={results} onCheckAgain={scrollToChecker} />
            )}
          </section>
        )}
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
