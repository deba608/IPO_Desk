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

// One column template shared by the header and every row so columns line up
// perfectly. The name track flexes; the rest are fixed. The whole table sits in
// an overflow-x-auto wrapper (see IPOCalendarView), so on narrow screens it
// scrolls horizontally instead of crushing the name column down to "L…".
const GRID_COLS =
  "grid grid-cols-[auto_minmax(180px,1.5fr)_4.5rem_6rem_6.5rem_6rem_6rem_6.5rem_5.5rem_6.5rem_6rem_1rem] items-center gap-x-3";

/** Minimum table width; the wrapper scrolls horizontally below this. */
export const LIST_MIN_WIDTH = "min-w-[1180px]";

/** Column header row for the list view (aligned to the same GRID_COLS). */
export function IPOCalendarListHeader() {
  const cell = "text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
  return (
    <div
      className={cn(
        GRID_COLS,
        LIST_MIN_WIDTH,
        "rounded-lg border border-border/60 bg-muted/40 px-4 py-2"
      )}
    >
      <span />
      <span className={cell}>IPO</span>
      <span className={cell}>Board</span>
      <span className={cell}>Price Band</span>
      <span className={cell}>Dates</span>
      <span className={cell}>Listing</span>
      <span className={cell}>Issue Size</span>
      <span className={cell}>Min. Invest</span>
      <span className={cell}>Subscr.</span>
      <span className={cn(cell, "text-right")}>GMP</span>
      <span className={cell}>Signals</span>
      <span />
    </div>
  );
}

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

  const val = "truncate text-xs font-medium text-foreground";

  return (
    <Link
      href={`/ipo/${ipo.id}`}
      className={cn(
        GRID_COLS,
        LIST_MIN_WIDTH,
        "group rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/50 hover:bg-card/80"
      )}
    >
      {/* Actions: watchlist + calendar reminder */}
      <div className="flex items-center gap-0.5">
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
            "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
            hydrated && watched
              ? "text-amber-400 hover:text-amber-300"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Star className={cn("h-3.5 w-3.5", hydrated && watched && "fill-current")} />
        </button>
        <AddToCalendarButton ipo={ipo} variant="icon" />
      </div>

      {/* Name + symbol + exchanges/registrar */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
            {ipo.name}
          </span>
          {ipo.symbol && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {ipo.symbol}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {ipo.exchanges.join(" · ")} · {REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}
        </p>
      </div>

      {/* Board */}
      <div className="min-w-0">
        <Badge
          variant={ipo.board === "mainboard" ? "default" : "outline"}
          className="text-[10px]"
        >
          {ipo.board === "mainboard" ? "Main" : "SME"}
        </Badge>
      </div>

      {/* Price band */}
      <p className={val}>{priceBand}</p>

      {/* Dates */}
      <p className={val}>{formatDateRange(ipo.openDate, ipo.closeDate)}</p>

      {/* Listing */}
      <p className={val}>{ipo.listingDate ? formatDate(ipo.listingDate) : "TBA"}</p>

      {/* Issue size */}
      <p className={val}>{formatCrore(ipo.issueSizeCr)}</p>

      {/* Min. investment */}
      <p className={val}>
        {ipo.minInvestment > 0 ? formatINR(ipo.minInvestment) : "TBA"}
      </p>

      {/* Subscription (popover when detail available) */}
      <div className="min-w-0">
        {subTotal === undefined ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : ipo.subscription ? (
          <SubscriptionDetailsPopover
            subscription={ipo.subscription}
            trigger={
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-indigo-400">
                <Flame className="h-3 w-3 shrink-0 text-orange-400" />
                {subTotal}×
              </span>
            }
          />
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <Flame className="h-3 w-3 shrink-0 text-orange-400" />
            {subTotal}×
          </span>
        )}
      </div>

      {/* GMP / listing gain */}
      <div className="text-right">
        {ipo.lifecycle === "listed" && gain !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold",
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
          </span>
        ) : ipo.gmp !== undefined ? (
          <span className="text-xs font-semibold text-emerald-400">
            ₹{ipo.gmp}
            {ipo.gmpPercent !== undefined && (
              <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                ({ipo.gmpPercent}%)
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Signals: status · anchor · rating */}
      <div className="flex min-w-0 items-center gap-1.5">
        <Badge variant={status.variant} className="gap-1 px-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          <span className="text-[10px]">{status.label}</span>
        </Badge>
        {ipo.anchorListed && (
          <span
            title="Anchor allotment announced"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-400"
          >
            <Anchor className="h-2.5 w-2.5" />
          </span>
        )}
        {ipo.rating !== undefined && (
          <span className="shrink-0 text-[11px]" title={`Crowd rating ${ipo.rating}/5`}>
            {"🔥".repeat(ipo.rating)}
          </span>
        )}
      </div>
      {/* Chevron */}
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

