"use client";

import Link from "next/link";
import {
  Building2,
  CalendarDays,
  IndianRupee,
  Layers,
  TrendingUp,
  TrendingDown,
  Rocket,
  Flame,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CalendarIPOWithStatus, IPOLifecycle } from "@/types/calendar.types";
import { cn } from "@/lib/utils";
import { formatCrore, formatINR, formatDate, formatDateRange } from "../lib/format";

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech: "KFintech",
  mufg: "MUFG Intime",
  linkintime: "Link Intime",
  bigshare: "Bigshare",
};

const LIFECYCLE_CONFIG: Record<
  IPOLifecycle,
  { label: string; variant: "info" | "success" | "warning" | "secondary"; dot: string }
> = {
  upcoming: { label: "Upcoming", variant: "info", dot: "bg-blue-400" },
  open: { label: "Open", variant: "success", dot: "bg-emerald-400 animate-pulse" },
  closed: { label: "Closed", variant: "warning", dot: "bg-amber-400" },
  listed: { label: "Listed", variant: "secondary", dot: "bg-slate-400" },
};

interface MetricProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function Metric({ icon: Icon, label, value }: MetricProps) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function IPOCalendarCard({ ipo }: { ipo: CalendarIPOWithStatus }) {
  const status = LIFECYCLE_CONFIG[ipo.lifecycle];
  const gain = ipo.listingGainPercent;
  const subTotal = ipo.subscription?.total;

  return (
    <Link
      href={`/ipo/${ipo.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold text-foreground group-hover:text-primary">
              {ipo.name}
            </h3>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={ipo.board === "mainboard" ? "default" : "outline"}
              className="text-[10px]"
            >
              {ipo.board === "mainboard" ? "Mainboard" : "SME"}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {ipo.exchanges.join(" · ")}
            </span>
          </div>
        </div>
        <Badge variant={status.variant} className="shrink-0 gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </Badge>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric
          icon={IndianRupee}
          label="Price Band"
          value={`₹${ipo.priceBand.min}–${ipo.priceBand.max}`}
        />
        <Metric icon={Building2} label="Issue Size" value={formatCrore(ipo.issueSizeCr)} />
        <Metric
          icon={Layers}
          label="Lot Size"
          value={`${ipo.lotSize.toLocaleString("en-IN")} shares`}
        />
        <Metric icon={IndianRupee} label="Min. Investment" value={formatINR(ipo.minInvestment)} />
        <Metric
          icon={CalendarDays}
          label="Subscription"
          value={formatDateRange(ipo.openDate, ipo.closeDate)}
        />
        <Metric
          icon={Rocket}
          label={ipo.lifecycle === "listed" ? "Listed On" : "Listing"}
          value={ipo.listingDate ? formatDate(ipo.listingDate) : "TBA"}
        />
      </div>

      {/* Subscription (when available) */}
      {subTotal !== undefined && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            Subscribed
          </span>
          <div className="flex items-center gap-3 text-xs">
            {ipo.subscription?.qib !== undefined && (
              <span className="text-muted-foreground">
                QIB <span className="font-medium text-foreground">{ipo.subscription.qib}×</span>
              </span>
            )}
            {ipo.subscription?.retail !== undefined && (
              <span className="text-muted-foreground">
                Retail <span className="font-medium text-foreground">{ipo.subscription.retail}×</span>
              </span>
            )}
            <span className="font-semibold text-primary">{subTotal}× total</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">
            {ipo.leadManagers[0]}
            {ipo.leadManagers.length > 1 && ` +${ipo.leadManagers.length - 1}`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Registrar:{" "}
            <span className="text-foreground/80">
              {REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}
            </span>
          </p>
        </div>

        {/* GMP (pre-listing) or listing gain (post-listing) */}
        {ipo.lifecycle === "listed" && gain !== undefined ? (
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
              gain >= 0
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-rose-500/15 text-rose-400"
            )}
          >
            {gain >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {gain >= 0 ? "+" : ""}
            {gain}%
          </div>
        ) : ipo.gmp !== undefined ? (
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">GMP</p>
            <p className="text-sm font-semibold text-emerald-400">
              ₹{ipo.gmp}
              {ipo.gmpPercent !== undefined && (
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  ({ipo.gmpPercent}%)
                </span>
              )}
            </p>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
