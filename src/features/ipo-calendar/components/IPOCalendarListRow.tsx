"use client";

import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Star,
  Flame,
  Anchor,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CalendarIPOWithStatus, IPOLifecycle } from "@/types/calendar.types";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import { formatCrore, formatINR, formatDate, formatDateRange } from "../lib/format";
import { AddToCalendarButton } from "./AddToCalendarButton";
import { SubscriptionDetailsPopover } from "./SubscriptionDetailsPopover";

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

export function IPOCalendarListRow({ ipo }: { ipo: CalendarIPOWithStatus }) {
  const status = LIFECYCLE_CONFIG[ipo.lifecycle];
  const gain = ipo.listingGainPercent;
  const subTotal = ipo.subscription?.total;
  const { isWatched, toggle, hydrated } = useWatchlist();
  const watched = isWatched(ipo.id);

  const priceBand =
    ipo.priceBand.min === ipo.priceBand.max
      ? `₹${ipo.priceBand.max}`
      : `₹${ipo.priceBand.min}–${ipo.priceBand.max}`;

  return (
    <Link
      href={`/ipo/${ipo.id}`}
      className="group relative flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-primary/50 hover:bg-card/80 sm:gap-4 sm:px-5"
    >
      {/* Watchlist button */}
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
          "shrink-0 rounded-md p-1 transition-colors",
          hydrated && watched
            ? "text-amber-400 hover:text-amber-300"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Star className={cn("h-3.5 w-3.5", hydrated && watched && "fill-current")} />
      </button>

      {/* Calendar reminder button */}
      <AddToCalendarButton ipo={ipo} variant="icon" />

      {/* Name + badges */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
            {ipo.name}
          </span>
          {ipo.symbol && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {ipo.symbol}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Badge
            variant={ipo.board === "mainboard" ? "default" : "outline"}
            className="text-[10px]"
          >
            {ipo.board === "mainboard" ? "Mainboard" : "SME"}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {ipo.exchanges.join(" · ")}
          </span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}
          </span>
        </div>
      </div>

      {/* Price Band */}
      <div className="hidden w-28 shrink-0 sm:block">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Price Band</p>
        <p className="text-xs font-medium text-foreground">{priceBand}</p>
      </div>

      {/* Dates */}
      <div className="hidden w-28 shrink-0 md:block">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dates</p>
        <p className="text-xs font-medium text-foreground">
          {formatDateRange(ipo.openDate, ipo.closeDate)}
        </p>
      </div>

      {/* Listing */}
      <div className="hidden w-24 shrink-0 lg:block">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {ipo.lifecycle === "listed" ? "Listed" : "Listing"}
        </p>
        <p className="text-xs font-medium text-foreground">
          {ipo.listingDate ? formatDate(ipo.listingDate) : "TBA"}
        </p>
      </div>

      {/* Issue Size */}
      <div className="hidden w-24 shrink-0 xl:block">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Issue Size</p>
        <p className="text-xs font-medium text-foreground">{formatCrore(ipo.issueSizeCr)}</p>
      </div>

      {/* Min. Investment */}
      <div className="hidden w-24 shrink-0 xl:block">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Min. Invest</p>
        <p className="text-xs font-medium text-foreground">
          {ipo.minInvestment > 0 ? formatINR(ipo.minInvestment) : "TBA"}
        </p>
      </div>

      {/* Subscription */}
      {subTotal !== undefined && (
        <div className="hidden w-20 shrink-0 lg:block">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Subscr.</p>
          {ipo.subscription ? (
            <SubscriptionDetailsPopover
              subscription={ipo.subscription}
              trigger={
                <p className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-indigo-400 transition-colors">
                  <Flame className="h-3 w-3 text-orange-400 animate-pulse" />
                  {subTotal}× ℹ️
                </p>
              }
            />
          ) : (
            <p className="flex items-center gap-1 text-xs font-semibold text-primary">
              <Flame className="h-3 w-3 text-orange-400" />
              {subTotal}×
            </p>
          )}
        </div>
      )}

      {/* GMP / Listing Gain */}
      <div className="shrink-0 w-20 text-right">
        {ipo.lifecycle === "listed" && gain !== undefined ? (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
              gain >= 0
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-rose-500/15 text-rose-400"
            )}
          >
            {gain >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {gain >= 0 ? "+" : ""}
            {gain}%
          </div>
        ) : ipo.gmp !== undefined ? (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">GMP</p>
            <p className="text-xs font-semibold text-emerald-400">
              ₹{ipo.gmp}
              {ipo.gmpPercent !== undefined && (
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  ({ipo.gmpPercent}%)
                </span>
              )}
            </p>
          </div>
        ) : null}
      </div>

      {/* Enrichment chips */}
      <div className="hidden shrink-0 items-center gap-1.5 md:flex">
        {ipo.anchorListed && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
            <Anchor className="h-2.5 w-2.5" />
            Anchor
          </span>
        )}
        {ipo.rating !== undefined && (
          <span
            className="rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-400"
            title={`Crowd rating ${ipo.rating}/5`}
          >
            {"🔥".repeat(ipo.rating)}
          </span>
        )}
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        <Badge variant={status.variant} className="gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          <span className="hidden sm:inline">{status.label}</span>
        </Badge>
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
