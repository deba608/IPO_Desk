import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  IndianRupee,
  Layers,
  TrendingUp,
  TrendingDown,
  ClipboardCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  findCalendarIPO,
  todayISO,
} from "@/features/ipo-calendar/lib/calendar.service";
import { formatCrore, formatINR } from "@/features/ipo-calendar/lib/format";
import nextDynamic from "next/dynamic";
import { SubscriptionBars } from "@/features/ipo-detail/components/SubscriptionBars";
import { AllotmentOdds } from "@/features/ipo-detail/components/AllotmentOdds";
import { Timeline } from "@/features/ipo-detail/components/Timeline";
import { AddToCalendar } from "@/features/ipo-detail/components/AddToCalendar";

// recharts-heavy sections load after the core IPO facts (code-split).
// (named nextDynamic: this route already exports `dynamic = "force-dynamic"`.)
const GMPDetailView = nextDynamic(
  () =>
    import("@/features/ipo-detail/components/GMPDetailView").then(
      (m) => m.GMPDetailView
    ),
  { loading: () => <p className="py-6 text-center text-xs text-muted-foreground">Loading GMP chart…</p> }
);
const ResearchReport = nextDynamic(
  () =>
    import("@/features/ipo-detail/components/ResearchReport").then(
      (m) => m.ResearchReport
    ),
  { loading: () => <p className="py-6 text-center text-xs text-muted-foreground">Loading research report…</p> }
);
import { AlertSettings } from "@/features/ipo-detail/components/AlertSettings";
import { Header } from "@/components/common/Header";

import { CompanyOverview } from "@/features/ipo-detail/components/CompanyOverview";
import { FinancialsTable } from "@/features/ipo-detail/components/FinancialsTable";
import { StrengthsRisks } from "@/features/ipo-detail/components/StrengthsRisks";
import { PeerComparison } from "@/features/ipo-detail/components/PeerComparison";
import { IpoFaq } from "@/features/ipo-detail/components/IpoFaq";

export const dynamic = "force-dynamic";

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech: "KFintech",
  mufg: "MUFG Intime",
  linkintime: "Link Intime",
  bigshare: "Bigshare",
  skyline: "Skyline",
  purva: "Purva Sharegistry",
  maashitla: "Maashitla",
};

const LIFECYCLE_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  open: "Open",
  closed: "Closed",
  listed: "Listed",
};

/** "₹398–419" for a real band, "₹84" for fixed-price issues (min === max). */
function bandLabel(band: { min: number; max: number }): string {
  return band.min === band.max ? `₹${band.max}` : `₹${band.min}–${band.max}`;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const ipo = await findCalendarIPO(id);
  if (!ipo) return { title: "IPO not found" };
  return {
    title: `${ipo.name} IPO — Price Band, GMP, Subscription & Dates`,
    description: `${ipo.name} IPO details: price band ${bandLabel(ipo.priceBand)}, lot size ${ipo.lotSize}, issue size ${formatCrore(ipo.issueSizeCr)}, subscription, GMP and listing dates.`,
  };
}

/* ── Compact stat chip ─────────────────────────────────────────────── */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-foreground">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ── Section wrapper — tighter padding ─────────────────────────────── */
function SectionCard({
  title,
  children,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card ${compact ? "p-3" : "px-4 py-3.5"}`}>
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

export default async function IPODetailPage({ params }: PageProps) {
  const { id } = await params;
  const ipo = await findCalendarIPO(id);
  if (!ipo) notFound();

  const today = todayISO();
  const gain = ipo.listingGainPercent;
  const estListing =
    ipo.gmp !== undefined ? ipo.priceBand.max + ipo.gmp : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto max-w-5xl px-4 py-5">
        {/* Breadcrumb */}
        <Link href="/calendar" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to calendar
        </Link>

        {/* ── Title row: name + GMP badge + alert ─────────── */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant={ipo.board === "mainboard" ? "default" : "outline"}>
                {ipo.board === "mainboard" ? "Mainboard" : "SME"}
              </Badge>
              <Badge variant={ipo.lifecycle === "open" ? "success" : ipo.lifecycle === "listed" ? "secondary" : "info"}>
                {LIFECYCLE_LABEL[ipo.lifecycle]}
              </Badge>
              <span className="text-[11px] text-muted-foreground">{ipo.exchanges.join(" · ")}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{ipo.name}</h1>
          </div>

          <div className="flex items-start gap-2">
            {/* GMP or listing gain chip */}
            {ipo.lifecycle === "listed" && gain !== undefined ? (
              <div className={`rounded-lg border px-3 py-2 text-right ${gain >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"}`}>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Listing Gain</p>
                <p className={`flex items-center gap-1 text-lg font-bold ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {gain >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {gain >= 0 ? "+" : ""}{gain}%
                </p>
              </div>
            ) : ipo.gmp !== undefined ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">GMP</p>
                <p className="text-lg font-bold text-emerald-400">
                  ₹{ipo.gmp}
                  {ipo.gmpPercent !== undefined && <span className="ml-1 text-xs font-normal text-muted-foreground">({ipo.gmpPercent}%)</span>}
                </p>
              </div>
            ) : null}
            <AlertSettings ipoId={ipo.id} ipoName={ipo.name} />
          </div>
        </div>

        {/* ── Key stats — compact row ─────────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Price Band" value={bandLabel(ipo.priceBand)} />
          <Stat label="Lot Size" value={`${ipo.lotSize.toLocaleString("en-IN")}`} hint="shares / lot" />
          <Stat label="Issue Size" value={formatCrore(ipo.issueSizeCr)} />
          <Stat label="Min. Investment" value={formatINR(ipo.minInvestment)} hint="retail, at cut-off" />
        </div>

        {/* ── Two-column layout ───────────────────────────── */}
        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          {/* Left column */}
          <div className="min-w-0 space-y-4 lg:col-span-2">
            {/* Company Overview & Issue Objects */}
            <SectionCard title="About Company & Issue Objects">
              <CompanyOverview ipo={ipo} />
            </SectionCard>

            {/* Financial Performance Highlights */}
            <SectionCard title="Financial Performance Track Record">
              <FinancialsTable ipo={ipo} />
            </SectionCard>

            {/* Strengths & Risks */}
            <SectionCard title="Investment Moats & Key Risks">
              <StrengthsRisks ipo={ipo} />
            </SectionCard>

            {/* Peer Comparison */}
            <SectionCard title="Peer Valuation Matrix">
              <PeerComparison ipo={ipo} />
            </SectionCard>

            {/* Subscription Status */}
            {ipo.subscription ? (
              <SectionCard title="Subscription Status" compact>
                <SubscriptionBars subscription={ipo.subscription} />
                {ipo.subscription.updatedAt && (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Updated{" "}
                    {new Date(ipo.subscription.updatedAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    IST
                  </p>
                )}
              </SectionCard>
            ) : (
              <SectionCard title="Subscription Status" compact>
                <p className="text-xs text-muted-foreground">
                  Subscription data appears once the issue opens.
                </p>
              </SectionCard>
            )}

            {/* Retail allotment odds */}
            {ipo.subscription?.retail !== undefined && (
              <SectionCard title="Allotment Odds (Retail)" compact>
                <AllotmentOdds
                  retailSubscription={ipo.subscription.retail}
                  minInvestment={ipo.minInvestment}
                />
              </SectionCard>
            )}

            {/* GMP analysis */}
            {estListing !== undefined && ipo.lifecycle !== "listed" && (
              <SectionCard title="GMP Analysis">
                <GMPDetailView ipoId={ipo.id} ipoName={ipo.name} capPrice={ipo.priceBand.max} lotSize={ipo.lotSize} gmpUpdatedAt={ipo.gmpUpdatedAt} gmpMin={ipo.gmpMin} gmpMax={ipo.gmpMax} />
              </SectionCard>
            )}

            {/* AI Research & Recommendation */}
            <SectionCard title="AI Research & Recommendation">
              <ResearchReport ipoId={ipo.id} />
            </SectionCard>

            {/* FAQs */}
            <SectionCard title="Frequently Asked Questions">
              <IpoFaq ipo={ipo} />
            </SectionCard>
          </div>

          {/* Right column */}
          <div className="min-w-0 space-y-4">
            <SectionCard title="Timeline" compact>
              <Timeline ipo={ipo} today={today} />
            </SectionCard>

            <SectionCard title="Issue Details" compact>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> Issue Size</dt>
                  <dd className="font-medium">{formatCrore(ipo.issueSizeCr)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><IndianRupee className="h-3.5 w-3.5" /> Price Band</dt>
                  <dd className="font-medium">{bandLabel(ipo.priceBand)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><Layers className="h-3.5 w-3.5" /> Lot Size</dt>
                  <dd className="font-medium">{ipo.lotSize.toLocaleString("en-IN")} shares</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Registrar</dt>
                  <dd className="font-medium">{REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}</dd>
                </div>
                {ipo.leadManagers.length > 0 && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Lead Manager{ipo.leadManagers.length > 1 ? "s" : ""}</dt>
                    <dd className="text-right font-medium">{ipo.leadManagers.join(", ")}</dd>
                  </div>
                )}
              </dl>
            </SectionCard>

            {/* Add to calendar */}
            <AddToCalendar ipo={ipo} />

            {/* CTA to allotment checker */}
            <Link
              href={`/?ipo=${encodeURIComponent(ipo.name)}`}
              className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-3 transition-colors hover:bg-primary/15"
            >
              <ClipboardCheck className="h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Check your allotment</p>
                <p className="text-[11px] text-muted-foreground">Verify PAN-wise allotment for this IPO</p>
              </div>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-3">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[10px] text-muted-foreground">© 2026 IPO Desk · GMP and grey-market figures are indicative, not investment advice.</p>
        </div>
      </footer>
    </div>
  );
}
