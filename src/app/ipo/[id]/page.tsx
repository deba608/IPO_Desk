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
import { SubscriptionBars } from "@/features/ipo-detail/components/SubscriptionBars";
import { Timeline } from "@/features/ipo-detail/components/Timeline";
import { AddToCalendar } from "@/features/ipo-detail/components/AddToCalendar";
import { GMPTrendChart } from "@/features/ipo-detail/components/GMPTrendChart";
import { ResearchReport } from "@/features/ipo-detail/components/ResearchReport";
import { AlertSettings } from "@/features/ipo-detail/components/AlertSettings";
import { Header } from "@/components/common/Header";

export const dynamic = "force-dynamic";

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech: "KFintech",
  mufg: "MUFG Intime",
  linkintime: "Link Intime",
  bigshare: "Bigshare",
};

const LIFECYCLE_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  open: "Open",
  closed: "Closed",
  listed: "Listed",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const ipo = await findCalendarIPO(id);
  if (!ipo) return { title: "IPO not found" };
  return {
    title: `${ipo.name} IPO — Price Band, GMP, Subscription & Dates`,
    description: `${ipo.name} IPO details: price band ₹${ipo.priceBand.min}–${ipo.priceBand.max}, lot size ${ipo.lotSize}, issue size ${formatCrore(ipo.issueSizeCr)}, subscription, GMP and listing dates.`,
  };
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-5xl px-4 py-8">
        {/* Breadcrumb */}
        <Link href="/calendar" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to calendar
        </Link>

        {/* Title block */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={ipo.board === "mainboard" ? "default" : "outline"}>
                {ipo.board === "mainboard" ? "Mainboard" : "SME"}
              </Badge>
              <Badge variant={ipo.lifecycle === "open" ? "success" : ipo.lifecycle === "listed" ? "secondary" : "info"}>
                {LIFECYCLE_LABEL[ipo.lifecycle]}
              </Badge>
              <span className="text-xs text-muted-foreground">{ipo.exchanges.join(" · ")}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{ipo.name}</h1>
          </div>

          {/* GMP or listing gain */}
          {ipo.lifecycle === "listed" && gain !== undefined ? (
            <div className={`rounded-xl border px-4 py-3 text-right ${gain >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"}`}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Listing Gain</p>
              <p className={`flex items-center gap-1 text-xl font-bold ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {gain >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {gain >= 0 ? "+" : ""}{gain}%
              </p>
            </div>
          ) : ipo.gmp !== undefined ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Grey Market Premium</p>
              <p className="text-xl font-bold text-emerald-400">
                ₹{ipo.gmp}
                {ipo.gmpPercent !== undefined && <span className="ml-1 text-sm font-normal text-muted-foreground">({ipo.gmpPercent}%)</span>}
              </p>
            </div>
          ) : null}
          <AlertSettings ipoId={ipo.id} ipoName={ipo.name} />
        </div>

        {/* Key stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Price Band" value={`₹${ipo.priceBand.min}–${ipo.priceBand.max}`} />
          <Stat label="Lot Size" value={`${ipo.lotSize.toLocaleString("en-IN")}`} hint="shares / lot" />
          <Stat label="Issue Size" value={formatCrore(ipo.issueSizeCr)} />
          <Stat label="Min. Investment" value={formatINR(ipo.minInvestment)} hint="retail, at cut-off" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            {ipo.subscription ? (
              <SectionCard title="Subscription Status">
                <SubscriptionBars subscription={ipo.subscription} />
                {ipo.subscription.updatedAt && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Updated {new Date(ipo.subscription.updatedAt).toLocaleString("en-IN")}
                  </p>
                )}
              </SectionCard>
            ) : (
              <SectionCard title="Subscription Status">
                <p className="text-sm text-muted-foreground">
                  Subscription data appears once the issue opens.
                </p>
              </SectionCard>
            )}

            {/* GMP analysis */}
            {estListing !== undefined && ipo.lifecycle !== "listed" && (
              <SectionCard title="GMP Analysis">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cap Price</p>
                    <p className="text-lg font-semibold">₹{ipo.priceBand.max}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">GMP</p>
                    <p className="text-lg font-semibold text-emerald-400">+₹{ipo.gmp}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Est. Listing</p>
                    <p className="text-lg font-semibold">₹{estListing}</p>
                  </div>
                  {ipo.gmpPercent !== undefined && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Est. Gain</p>
                      <p className="text-lg font-semibold text-emerald-400">{ipo.gmpPercent}%</p>
                    </div>
                  )}
                </div>
                <div className="mt-5">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">GMP Trend</p>
                  <GMPTrendChart ipoId={ipo.id} />
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Grey-market premium is unofficial and volatile — for reference only, not investment advice.
                </p>
              </SectionCard>
            )}

            {/* AI Research & Recommendation */}
            <SectionCard title="AI Research & Recommendation">
              <ResearchReport ipoId={ipo.id} />
            </SectionCard>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <SectionCard title="Timeline">
              <Timeline ipo={ipo} today={today} />
            </SectionCard>

            <SectionCard title="Issue Details">
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4" /> Issue Size</dt>
                  <dd className="font-medium">{formatCrore(ipo.issueSizeCr)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground"><IndianRupee className="h-4 w-4" /> Price Band</dt>
                  <dd className="font-medium">₹{ipo.priceBand.min}–{ipo.priceBand.max}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground"><Layers className="h-4 w-4" /> Lot Size</dt>
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

            {/* CTA to allotment checker — deep-links with the IPO preselected */}
            <Link
              href={`/?ipo=${encodeURIComponent(ipo.name)}`}
              className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 transition-colors hover:bg-primary/15"
            >
              <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Check your allotment</p>
                <p className="text-xs text-muted-foreground">Verify PAN-wise allotment for this IPO</p>
              </div>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">© 2026 IPO Desk · GMP and grey-market figures are indicative, not investment advice.</p>
        </div>
      </footer>
    </div>
  );
}
