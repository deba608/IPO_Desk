"use client";

import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Star,
  Flame,
  Anchor,
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

// Desktop (lg+) column template shared by the header and every row so columns
// line up perfectly. Tracks use minmax(min,fr) so the whole table fits the
// available width — no horizontal scroll. Board badge folds into the name cell
// and the chevron column is gone to keep every column comfortably wide. Below
// lg the row switches to a stacked card — see the mobile block.
const GRID_COLS =
  "lg:grid lg:grid-cols-[auto_minmax(140px,1.6fr)_minmax(58px,0.7fr)_minmax(74px,0.9fr)_minmax(78px,0.9fr)_minmax(68px,0.8fr)_minmax(82px,0.9fr)_minmax(62px,0.75fr)_minmax(88px,1fr)_minmax(140px,1.2fr)] lg:items-center lg:gap-x-3";

/** No forced min-width — the grid fits its container so nothing scrolls sideways. */
export const LIST_MIN_WIDTH = "";

/** Column header row for the list view — desktop only (mobile rows are cards). */
export function IPOCalendarListHeader() {
  const cell = "text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
  return (
    <div
      className={cn(
        "hidden",
        GRID_COLS,
        LIST_MIN_WIDTH,
        "rounded-lg border border-border/60 bg-muted/40 px-4 py-2 lg:grid"
      )}
    >
      <span />
      <span className={cell}>IPO</span>
      <span className={cell}>Price Band</span>
      <span className={cell}>Dates</span>
      <span className={cell}>Listing</span>
      <span className={cell}>Issue Size</span>
      <span className={cell}>Min. Invest</span>
      <span className={cell}>Subscr.</span>
      <span className={cell}>GMP</span>
      <span className={cell}>Signals</span>
    </div>
  );
}

/** Compact "label: value" chip used in the mobile stacked layout. */
function MobileStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="truncate text-xs font-medium text-foreground">{children}</div>
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

  const starButton = (
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
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors lg:h-6 lg:w-6",
        hydrated && watched
          ? "text-amber-400 hover:text-amber-300"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Star className={cn("h-4 w-4 lg:h-3.5 lg:w-3.5", hydrated && watched && "fill-current")} />
    </button>
  );

  const statusBadge = (
    <Badge variant={status.variant} className="gap-1 px-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
      <span className="text-[10px]">{status.label}</span>
    </Badge>
  );

  const gmpNode =
    ipo.lifecycle === "listed" && gain !== undefined ? (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold",
          gain >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
        )}
      >
        {gain >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
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
    );

  const subscriptionNode =
    subTotal === undefined ? (
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
    );

  const signals = (
    <>
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
          {"\u{1F525}".repeat(ipo.rating)}
        </span>
      )}
    </>
  );

  return (
    <Link
      href={`/ipo/${ipo.id}`}
      className={cn(
        "group block rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-card/80 lg:px-4",
        GRID_COLS,
        LIST_MIN_WIDTH
      )}
    >
      {/* ── MOBILE / TABLET stacked card (below lg) ─────────────── */}
      <div className="space-y-2.5 lg:hidden">
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-0.5">
            {starButton}
            <AddToCalendarButton ipo={ipo} variant="icon" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground group-hover:text-primary">
              {ipo.name}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge
                variant={ipo.board === "mainboard" ? "default" : "outline"}
                className="shrink-0 text-[9px]"
              >
                {ipo.board === "mainboard" ? "Main" : "SME"}
              </Badge>
              <span className="truncate text-[11px] text-muted-foreground">
                {ipo.exchanges.join(" · ")} · {REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {statusBadge}
            {gmpNode}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-lg bg-muted/30 px-3 py-2">
          <MobileStat label="Price">{priceBand}</MobileStat>
          <MobileStat label="Dates">{formatDateRange(ipo.openDate, ipo.closeDate)}</MobileStat>
          <MobileStat label={ipo.lifecycle === "listed" ? "Listed" : "Listing"}>
            {ipo.listingDate ? formatDate(ipo.listingDate) : "TBA"}
          </MobileStat>
          <MobileStat label="Min. Invest">
            {ipo.minInvestment > 0 ? formatINR(ipo.minInvestment) : "TBA"}
          </MobileStat>
          <MobileStat label="Subscr.">{subscriptionNode}</MobileStat>
          <MobileStat label="Issue">{formatCrore(ipo.issueSizeCr)}</MobileStat>
          {(ipo.anchorListed || ipo.rating !== undefined) && (
            <div className="col-span-1 flex items-end gap-1.5">{signals}</div>
          )}
        </div>
      </div>

      {/* ── DESKTOP grid cells (lg+) — display:contents so the parent grid lays them out ── */}
      <div className="hidden lg:contents">
        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {starButton}
          <AddToCalendarButton ipo={ipo} variant="icon" />
        </div>

        {/* Name (board badge folded in) */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Badge
              variant={ipo.board === "mainboard" ? "default" : "outline"}
              className="shrink-0 text-[10px]"
            >
              {ipo.board === "mainboard" ? "Main" : "SME"}
            </Badge>
            <span className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
              {ipo.name}
            </span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {ipo.exchanges.join(" · ")} · {REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}
          </p>
        </div>

        <p className={val}>{priceBand}</p>
        <p className={val}>{formatDateRange(ipo.openDate, ipo.closeDate)}</p>
        <p className={val}>{ipo.listingDate ? formatDate(ipo.listingDate) : "TBA"}</p>
        <p className={val}>{formatCrore(ipo.issueSizeCr)}</p>
        <p className={val}>
          {ipo.minInvestment > 0 ? formatINR(ipo.minInvestment) : "TBA"}
        </p>
        <div className="flex min-w-0 items-center">{subscriptionNode}</div>
        <div className="flex min-w-0 items-center">{gmpNode}</div>
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {statusBadge}
          {signals}
        </div>
      </div>
    </Link>
  );
}
