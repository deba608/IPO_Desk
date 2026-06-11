"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Shield,
  Zap,
  Users,
  CheckCircle2,
  BarChart3,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import { IPOSelector } from "@/features/ipo-checker/components/IPOSelector";
import { CheckerTabs } from "@/features/ipo-checker/components/CheckerTabs";
import { ResultsDashboard } from "@/features/ipo-checker/components/ResultsDashboard";
import { CheckResponse } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";

export default function Home() {
  const [selectedIPO, setSelectedIPO] = useState<IPO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CheckResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleCheck = useCallback(
    async (pans: string[]) => {
      if (!selectedIPO) {
        toast.error("Please select an IPO first");
        return;
      }

      if (pans.length === 0) {
        toast.error("Please enter at least one PAN");
        return;
      }

      setIsLoading(true);
      setProgress(10);

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setProgress((p) => Math.min(p + 5, 85));
        }, 300);

        const response = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pans,
            // Namespaced id so the backend resolves the right registrar even
            // when two registrars reuse the same numeric clientId
            ipoClientId: selectedIPO.id,
          }),
        });

        clearInterval(progressInterval);
        setProgress(100);

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error ?? "Check failed");
        }

        const data: CheckResponse = await response.json();
        setResults(data);

        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);

        const allotted = data.summary.allotted;
        const total = data.summary.total;

        if (allotted > 0) {
          toast.success(
            `🎉 ${allotted} of ${total} PANs got allotment!`,
            { duration: 5000 }
          );
        } else {
          toast.info(`Checked ${total} PANs — No allotments found`, {
            duration: 4000,
          });
        }
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : "Something went wrong";
        toast.error(msg);
      } finally {
        setIsLoading(false);
        setTimeout(() => setProgress(0), 1000);
      }
    },
    [selectedIPO]
  );

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
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="IPO Desk"
              width={36}
              height={36}
              className="rounded-lg"
              priority
            />
            <span className="text-lg font-bold tracking-tight">IPO Desk</span>
          </div>
          <nav className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Powered by KFintech
            </span>
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden text-xs text-emerald-400 sm:inline">Live</span>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 py-20">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="absolute inset-0">
            <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          </div>

          <div className="relative container mx-auto max-w-5xl text-center">
                {/* Title */}
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Check IPO Allotment
              <span className="block gradient-text">in Seconds</span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
              Check allotment status for single or multiple PANs instantly.
              Upload Excel files for bulk checking. Export results to CSV or
              Excel.
            </p>

            {/* Feature pills */}
            <div className="mb-12 flex flex-wrap justify-center gap-3">
              {[
                { icon: Shield, text: "Secure & Private" },
                { icon: Zap, text: "Instant Results" },
                { icon: Users, text: "Bulk Processing" },
                { icon: FileSpreadsheet, text: "Excel Upload" },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {text}
                </div>
              ))}
            </div>            
          </div>
        </section>

        {/* Main Checker Card */}
        <section className="container mx-auto max-w-4xl px-4 pb-8">
          <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
            {/* Card Header */}
            <div className="border-b border-border px-8 py-6">
              <h2 className="text-xl font-semibold">Check Allotment Status</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an IPO, enter PAN number(s), and check your allotment status
              </p>
            </div>

            {/* IPO Selector */}
            <div className="px-8 py-6 border-b border-border">
              <IPOSelector
                value={selectedIPO}
                onChange={setSelectedIPO}
              />
            </div>

            {/* Input Tabs */}
            <div className="px-8 py-6">
              <CheckerTabs
                onCheck={handleCheck}
                isLoading={isLoading}
                progress={progress}
                selectedIPO={selectedIPO}
              />
            </div>
          </div>
        </section>

        {/* Results Section */}
        {results && (
          <section
            ref={resultsRef}
            className="container mx-auto max-w-6xl px-4 pb-16"
          >
            <ResultsDashboard results={results} />
          </section>
        )}

        {/* How It Works */}
        {!results && (
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
                  desc: "Choose from 28 active KFintech IPOs in the dropdown",
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

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Made with ❤️ by Dev 
          </p>
        </div>
      </footer>
    </div>
  );
}
