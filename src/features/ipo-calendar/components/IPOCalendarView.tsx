"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarRange, Clock, Search, ArrowUpDown, Star, X } from "lucide-react";
import {
  CalendarIPOWithStatus,
  CalendarResponse,
  IPOBoard,
  IPOLifecycle,
} from "@/types/calendar.types";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import { sortCalendar, SORT_OPTIONS, SortKey } from "../lib/calendar-sort";
import { IPOCalendarCard } from "./IPOCalendarCard";
import { CalendarHighlights } from "./CalendarHighlights";

type LifecycleTab = IPOLifecycle | "all" | "watchlist";
type BoardFilter = IPOBoard | "all";

const LIFECYCLE_TABS: { key: LifecycleTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "upcoming", label: "Upcoming" },
  { key: "closed", label: "Closed" },
  { key: "listed", label: "Listed" },
];

const BOARD_FILTERS: { key: BoardFilter; label: string }[] = [
  { key: "all", label: "All boards" },
  { key: "mainboard", label: "Mainboard" },
  { key: "sme", label: "SME" },
];

type SortKey =
  | "openDate_desc"
  | "openDate_asc"
  | "closeDate_asc"
  | "listingDate_asc"
  | "issueSize_desc"
  | "gmp_desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "openDate_desc", label: "Open Date (Newest)" },
  { key: "openDate_asc", label: "Open Date (Oldest)" },
  { key: "closeDate_asc", label: "Close Date (Earliest)" },
  { key: "listingDate_asc", label: "Listing Date (Earliest)" },
  { key: "issueSize_desc", label: "Issue Size (Largest)" },
  { key: "gmp_desc", label: "GMP (Highest)" },
];

function sortIPOs(ipos: CalendarIPOWithStatus[], sortKey: SortKey): CalendarIPOWithStatus[] {
  return [...ipos].sort((a, b) => {
    switch (sortKey) {
      case "openDate_desc":
        return (b.openDate ?? "").localeCompare(a.openDate ?? "");
      case "openDate_asc":
        return (a.openDate ?? "").localeCompare(b.openDate ?? "");
      case "closeDate_asc":
        return (a.closeDate ?? "").localeCompare(b.closeDate ?? "");
      case "listingDate_asc": {
        // IPOs without a listing date go to the end
        const la = a.listingDate ?? "9999";
        const lb = b.listingDate ?? "9999";
        return la.localeCompare(lb);
      }
      case "issueSize_desc":
        return (b.issueSizeCr ?? 0) - (a.issueSizeCr ?? 0);
      case "gmp_desc":
        return (b.gmp ?? -Infinity) - (a.gmp ?? -Infinity);
      default:
        return 0;
    }
  });
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function IPOCalendarView() {
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<LifecycleTab>("open");
  const [board, setBoard] = useState<BoardFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("openDate_desc");
  const [now, setNow] = useState(() => Date.now());
  const didInit = useRef(false);

  // Tick every second so the live IST clock and "updated Xs ago" stay current.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Single fetcher reused for the initial load, interval polling, and focus
  // refresh. Background refreshes keep the current list on screen (no skeleton
  // flash) and never override the user's selected tab.
  const load = useCallback(async (background: boolean) => {
    try {
      // Background polls bypass the server cache so data stays fresh within ~60s.
      const url = background ? "/api/calendar?refresh=true" : "/api/calendar";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load calendar");
      const json: CalendarResponse = await res.json();
      setData(json);
      setError(null);
      if (!didInit.current) {
        didInit.current = true;
        // On first load only, default to the first tab that actually has IPOs.
        if (json.counts.open === 0) {
          const firstWithData =
            (["upcoming", "listed", "closed"] as IPOLifecycle[]).find(
              (k) => json.counts[k] > 0
            ) ?? "all";
          setTab(firstWithData);
        }
      }
    } catch {
      // Keep the last good data on background refresh failures.
      if (!background) setError("Could not load the IPO calendar. Please refresh.");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // `load` only sets state after `await fetch`, so this is an async
    // subscription to an external system (the API), not a synchronous
    // render-time setState — safe despite the lint rule's conservative warning.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);

    // Poll so lifecycle status (derived from IST "today") and counts stay live.
    const interval = setInterval(() => load(true), 60_000);

    // Refresh immediately when the user returns to the tab.
    const onFocus = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const visible = useMemo<CalendarIPOWithStatus[]>(() => {
    if (!data) return [];
    const filtered = data.ipos.filter(
      (ipo) =>
        (tab === "all" || ipo.lifecycle === tab) &&
        (board === "all" || ipo.board === board)
    );
    return sortIPOs(filtered, sortKey);
  }, [data, tab, board, sortKey]);

  // Live IST wall-clock, re-rendered every second via `now`.
  const istClock = useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(new Date(now)),
    [now]
  );

  // "just now" / "12s ago" / "3m ago" since the last successful fetch.
  const updatedAgo = useMemo(() => {
    if (!data) return "";
    const secs = Math.max(0, Math.round((now - new Date(data.lastUpdated).getTime()) / 1000));
    if (secs < 5) return "just now";
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  }, [data, now]);

  return (
    <div className="space-y-6">
      {/* Live IST clock + auto-refresh indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="tabular-nums">{istClock} IST</span>
        </div>
        {data?.dataSource === "live" ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live · auto-refresh
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 text-xs text-amber-400"
            title="Showing curated sample data. Set IPOGURU_API_KEY to go live."
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Sample data
          </div>
        )}
      </div>

      {/* Lifecycle tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {LIFECYCLE_TABS.map(({ key, label }) => {
          const count =
            key === "all" ? data?.total : data?.counts[key as IPOLifecycle];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                tab === key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {label}
              {count !== undefined && (
                <span
                  className={cn(
                    "ml-2 rounded-full px-1.5 py-0.5 text-[11px]",
                    tab === key ? "bg-primary/20" : "bg-muted"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Board filter + Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Board filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {BOARD_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setBoard(key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                board === key
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="ipo-sort"
            className="text-xs text-muted-foreground whitespace-nowrap"
          >
            Sort by
          </label>
          <select
            id="ipo-sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className={cn(
              "rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs",
              "text-foreground transition-colors",
              "hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          >
            {SORT_OPTIONS.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <CalendarRange className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No {board !== "all" ? `${board} ` : ""}IPOs in this category right now.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((ipo) => (
            <IPOCalendarCard key={ipo.id} ipo={ipo} />
          ))}
        </div>
      )}

      {data && (
        <p className="text-xs text-muted-foreground">
          Showing {visible.length} of {data.total} IPOs · Updated {updatedAgo}
        </p>
      )}
    </div>
  );
}
