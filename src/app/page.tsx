"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Shield,
  Zap,
  Users,
  FileSpreadsheet,
  ScanSearch,
  Target,
} from "lucide-react";
import { IPOSelector } from "@/features/ipo-checker/components/IPOSelector";
import { CheckerTabs } from "@/features/ipo-checker/components/CheckerTabs";
import { ResultsDashboard } from "@/features/ipo-checker/components/ResultsDashboard";
import { ScanResultsDashboard } from "@/features/ipo-checker/components/ScanResultsDashboard";
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
        <section className="relative overflow-hidden px-4 py-14">
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
            <div className="mb-6 flex flex-wrap justify-center gap-3">
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

        {/* Main Checker Card */}
        <section
          ref={checkerRef}
          className="container mx-auto max-w-4xl px-4 pb-8"
        >
          <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
            {/* Card Header */}
            <div className="flex flex-col gap-4 border-b border-border px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Check Allotment Status</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select an IPO, enter PAN number(s), and check your allotment status
                </p>
              </div>

              {/* Mode toggle: single IPO vs scan all active IPOs */}
              <div className="relative flex w-full rounded-full border border-border bg-muted/30 p-0.5 sm:w-auto shrink-0">
                {/* Sliding indicator — springy bounce on switch */}
                <span
                  aria-hidden
                  className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-card shadow-sm transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${
                    scanMode ? "translate-x-full" : "translate-x-0"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setScanMode(false)}
                  className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    !scanMode
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Target
                    className={`h-3.5 w-3.5 transition-transform duration-300 ${
                      !scanMode ? "scale-110" : "scale-100"
                    }`}
                  />
                  Single IPO
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode(true)}
                  className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    scanMode
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ScanSearch
                    className={`h-3.5 w-3.5 transition-transform duration-300 ${
                      scanMode ? "scale-110" : "scale-100"
                    }`}
                  />
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
