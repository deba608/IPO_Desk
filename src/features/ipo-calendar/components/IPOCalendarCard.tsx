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
  Star,
  Anchor,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CalendarIPOWithStatus, IPOLifecycle } from "@/types/calendar.types";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import { formatCrore, formatINR, formatDate, formatDateRange } from "../lib/format";

/** "Closes in 2d" / "Opens today" / "Lists in 5d" relative to now (IST dates). */
function relativeChip(ipo: CalendarIPOWithStatus): string | null {
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfTodayIST = () => {
    const iso = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return new Date(`${iso}T00:00:00+05:30`).getTime();
  };
  const daysUntil = (iso: string) =>
    Math.round((new Date(`${iso}T00:00:00+05:30`).getTime() - startOfTodayIST()) / dayMs);
  const word = (n: number) => (n === 0 ? "today" : n === 1 ? "in 1 day" : `in ${n} days`);

  switch (ipo.lifecycle) {
    case "upcoming":
      return `Opens ${word(daysUntil(ipo.openDate))}`;
    case "open":
      return `Closes ${word(daysUntil(ipo.closeDate))}`;
    case "closed":
      return ipo.listingDate ? `Lists ${word(daysUntil(ipo.listingDate))}` : null;
    default:
      return null;
  }
}

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
  const chip = relativeChip(ipo);
  const { isWatched, toggle, hydrated } = useWatchlist();
  const watched = isWatched(ipo.id);

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
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
            aria-pressed={watched}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(ipo.id);
            }}
            className={cn(
              "rounded-md p-1 transition-colors",
              hydrated && watched
                ? "text-amber-400 hover:text-amber-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className={cn("h-4 w-4", hydrated && watched && "fill-current")} />
          </button>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={status.variant} className="gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </Badge>
            {chip && (
              <span className="text-[10px] font-medium text-muted-foreground">{chip}</span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric
          icon={IndianRupee}
          label="Price Band"
          value={
            ipo.priceBand.min === ipo.priceBand.max
              ? `₹${ipo.priceBand.max}`
              : `₹${ipo.priceBand.min}–${ipo.priceBand.max}`
          }
        />
        <Metric icon={Building2} label="Issue Size" value={formatCrore(ipo.issueSizeCr)} />
        <Metric
          icon={Layers}
          label="Lot Size"
          value={ipo.lotSize > 0 ? `${ipo.lotSize.toLocaleString("en-IN")} shares` : "TBA"}
        />
        <Metric
          icon={IndianRupee}
          label="Min. Investment"
          value={ipo.minInvestment > 0 ? formatINR(ipo.minInvestment) : "TBA"}
        />
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

      {/* Enrichment chips: crowd rating · P/E · anchor (from InvestorGain) */}
      {(ipo.rating !== undefined ||
        ipo.peRatio !== undefined ||
        ipo.anchorListed !== undefined) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {ipo.rating !== undefined && (
            <span
              className="inline-flex items-center gap-0.5 rounded-md bg-orange-500/10 px-1.5 py-0.5 font-medium text-orange-400"
              title={`Crowd rating ${ipo.rating}/5`}
            >
              {"🔥".repeat(ipo.rating)}
            </span>
          )}
          {ipo.peRatio !== undefined && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
              P/E <span className="font-medium text-foreground">{ipo.peRatio}</span>
            </span>
          )}
          {ipo.anchorListed && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-400">
              <Anchor className="h-3 w-3" />
              Anchor
            </span>
          )}
        </div>
      )}

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
