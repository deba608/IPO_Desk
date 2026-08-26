"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarRange, Clock, Download, LayoutGrid, List, Search, SlidersHorizontal, Star, X } from "lucide-react";
import {
  CalendarIPOWithStatus,
  CalendarResponse,
  IPOBoard,
  IPOLifecycle,
} from "@/types/calendar.types";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import { IPOCalendarCard } from "./IPOCalendarCard";
import { IPOCalendarListRow, IPOCalendarListHeader } from "./IPOCalendarListRow";
import { CalendarHighlights } from "./CalendarHighlights";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { exportIPOs } from "../lib/export";

type ViewMode = "grid" | "list";

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech: "KFintech",
  mufg: "MUFG Intime",
  linkintime: "Link Intime",
  bigshare: "Bigshare",
};

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

// Self-ticking 1s components — isolates the per-second re-render to a tiny
// leaf instead of re-rendering the whole calendar tree every second.
const IST_CLOCK_FORMAT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

function useNowTicker() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function LiveISTClock() {
  const now = useNowTicker();
  return (
    <span className="tabular-nums">
      {IST_CLOCK_FORMAT.format(now)} IST
    </span>
  );
}

function UpdatedAgo({ lastUpdated }: { lastUpdated: string }) {
  const now = useNowTicker();
  const secs = Math.max(
    0,
    Math.round((now - new Date(lastUpdated).getTime()) / 1000)
  );
  const text =
    secs < 5 ? "just now" : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;
  return <span>Updated {text}</span>;
}

export function IPOCalendarView() {
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<LifecycleTab>("open");
  const [board, setBoard] = useState<BoardFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("openDate_desc");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [gmpFilter, setGmpFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [registrarFilter, setRegistrarFilter] = useState("all");
  const didInit = useRef(false);
  const urlHydrated = useRef(false);
  const { ids: watchedIds, isWatched } = useWatchlist();

  const uniqueRegistrars = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.ipos.map((ipo) => ipo.registrar));
    return Array.from(set).filter(Boolean);
  }, [data]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (gmpFilter !== "all") count++;
    if (sizeFilter !== "all") count++;
    if (registrarFilter !== "all") count++;
    return count;
  }, [gmpFilter, sizeFilter, registrarFilter]);

  const resetFilters = () => {
    setGmpFilter("all");
    setSizeFilter("all");
    setRegistrarFilter("all");
  };

  // Restore view mode preference from localStorage. Guarded — blocked
  // storage (private mode, hardened browsers) throws on access.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ipo-calendar-view") as ViewMode | null;
      if (saved === "grid" || saved === "list") setViewMode(saved);
    } catch {
      // Storage unavailable — default view is fine.
    }
  }, []);

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("ipo-calendar-view", mode);
    } catch {
      // Non-fatal.
    }
  };

  // Hydrate filters from URL search params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    
    const urlTab = params.get("tab") as LifecycleTab | null;
    if (urlTab && ["all", "open", "upcoming", "closed", "listed", "watchlist"].includes(urlTab)) {
      setTab(urlTab);
    }
    
    const urlBoard = params.get("board") as BoardFilter | null;
    if (urlBoard && ["all", "mainboard", "sme"].includes(urlBoard)) {
      setBoard(urlBoard);
    }
    
    const urlQuery = params.get("q");
    if (urlQuery) {
      setQuery(urlQuery);
    }
    
    const urlGmp = params.get("gmp");
    if (urlGmp && ["all", "positive", "strong", "discount"].includes(urlGmp)) {
      setGmpFilter(urlGmp);
    }
    
    const urlSize = params.get("size");
    if (urlSize && ["all", "large", "mid", "small"].includes(urlSize)) {
      setSizeFilter(urlSize);
    }
    
    const urlReg = params.get("registrar");
    if (urlReg) {
      setRegistrarFilter(urlReg);
    }

    const hasActiveFilters = 
      (urlGmp && urlGmp !== "all") || 
      (urlSize && urlSize !== "all") || 
      (urlReg && urlReg !== "all");
    if (hasActiveFilters) {
      setShowFiltersPanel(true);
    }

    urlHydrated.current = true;
  }, []);

  // Update URL search parameters when filters change
  useEffect(() => {
    if (typeof window === "undefined" || !urlHydrated.current) return;
    
    const params = new URLSearchParams();
    if (tab !== "open") params.set("tab", tab);
    if (board !== "all") params.set("board", board);
    if (query.trim() !== "") params.set("q", query.trim());
    if (gmpFilter !== "all") params.set("gmp", gmpFilter);
    if (sizeFilter !== "all") params.set("size", sizeFilter);
    if (registrarFilter !== "all") params.set("registrar", registrarFilter);
    
    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    
    window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
  }, [tab, board, query, gmpFilter, sizeFilter, registrarFilter]);

  // Single fetcher reused for the initial load, interval polling, and focus
  // refresh. Background refreshes keep the current list on screen (no skeleton
  // flash) and never override the user's selected tab.
  const load = useCallback(async (background: boolean) => {
    try {
      // The server-side catalogue cache has a 60s TTL, matching the poll
      // interval — no need for the (secret-gated) ?refresh=true bypass here.
      const res = await fetch("/api/calendar", { cache: "no-store" });
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

  const watchedCount = useMemo(
    () => (data ? data.ipos.filter((ipo) => watchedIds.includes(ipo.id)).length : 0),
    [data, watchedIds]
  );

  const visible = useMemo<CalendarIPOWithStatus[]>(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const filtered = data.ipos.filter((ipo) => {
      const matchesTab =
        tab === "all"
          ? true
          : tab === "watchlist"
          ? isWatched(ipo.id)
          : ipo.lifecycle === tab;
      const matchesBoard = board === "all" || ipo.board === board;
      const matchesQuery =
        q === "" ||
        ipo.name.toLowerCase().includes(q) ||
        (ipo.symbol?.toLowerCase().includes(q) ?? false);
      
      // GMP filter
      let matchesGmp = true;
      if (gmpFilter === "positive") {
        matchesGmp = ipo.gmpPercent !== undefined && ipo.gmpPercent >= 0;
      } else if (gmpFilter === "strong") {
        matchesGmp = ipo.gmpPercent !== undefined && ipo.gmpPercent >= 20;
      } else if (gmpFilter === "discount") {
        matchesGmp = ipo.gmpPercent !== undefined && ipo.gmpPercent < 0;
      }

      // Issue size filter
      let matchesSize = true;
      if (sizeFilter === "large") {
        matchesSize = ipo.issueSizeCr >= 1000;
      } else if (sizeFilter === "mid") {
        matchesSize = ipo.issueSizeCr >= 100 && ipo.issueSizeCr < 1000;
      } else if (sizeFilter === "small") {
        matchesSize = ipo.issueSizeCr < 100;
      }

      // Registrar filter
      const matchesRegistrar = registrarFilter === "all" || ipo.registrar === registrarFilter;

      return matchesTab && matchesBoard && matchesQuery && matchesGmp && matchesSize && matchesRegistrar;
    });
    return sortIPOs(filtered, sortKey);
  }, [data, tab, board, sortKey, query, isWatched, gmpFilter, sizeFilter, registrarFilter]);

  return (
    <div className="space-y-6">
      {/* Live IST clock + auto-refresh indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <LiveISTClock />
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

      {/* At-a-glance highlights */}
      {data && data.ipos.length > 0 && <CalendarHighlights ipos={data.ipos} />}

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

        {/* Watchlist tab */}
        <button
          type="button"
          onClick={() => setTab("watchlist")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
            tab === "watchlist"
              ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
              : "border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-400"
          )}
        >
          <Star className={cn("h-3.5 w-3.5", watchedCount > 0 && "fill-current")} />
          Watchlist
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[11px]",
              tab === "watchlist" ? "bg-amber-500/20" : "bg-muted"
            )}
          >
            {watchedCount}
          </span>
        </button>
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

        {/* Search + Sort + View Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 focus-within:border-primary relative">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-20 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground sm:w-36"
            />
            <kbd className="hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground">
              Ctrl + K
            </kbd>
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          
          {/* Advanced filters toggle */}
          <button
            type="button"
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              showFiltersPanel || activeFiltersCount > 0
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <label
            htmlFor="ipo-sort"
            className="hidden text-xs text-muted-foreground whitespace-nowrap sm:inline"
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

          {/* Export dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-40 bg-slate-900 border-slate-800 text-slate-100 p-2 shadow-xl"
              align="end"
            >
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => exportIPOs(visible, "xlsx")}
                  className="rounded-lg px-2 py-1.5 text-xs text-left text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors w-full"
                >
                  Download Excel
                </button>
                <button
                  type="button"
                  onClick={() => exportIPOs(visible, "csv")}
                  className="rounded-lg px-2 py-1.5 text-xs text-left text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors w-full"
                >
                  Download CSV
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Grid / List view toggle */}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              aria-label="Grid view"
              title="Grid view"
              onClick={() => switchView("grid")}
              className={cn(
                "flex items-center justify-center rounded-md p-1.5 transition-colors",
                viewMode === "grid"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="List view"
              title="List view"
              onClick={() => switchView("list")}
              className={cn(
                "flex items-center justify-center rounded-md p-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible filters panel */}
      {showFiltersPanel && (
        <div className="grid gap-3 rounded-xl border border-border bg-muted/10 p-4 sm:grid-cols-4 items-end animate-in fade-in-50 duration-200">
          {/* GMP Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">GMP Premium</label>
            <select
              value={gmpFilter}
              onChange={(e) => setGmpFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="all">All IPOs</option>
              <option value="positive">Positive GMP (≥ 0%)</option>
              <option value="strong">Strong GMP (≥ 20%)</option>
              <option value="discount">Discount/Negative (&lt; 0%)</option>
            </select>
          </div>

          {/* Issue Size Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Issue Size</label>
            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="all">All Sizes</option>
              <option value="large">Large Cap (≥ 1,000 Cr)</option>
              <option value="mid">Mid Cap (100 - 1,000 Cr)</option>
              <option value="small">Small Cap (&lt; 100 Cr)</option>
            </select>
          </div>

          {/* Registrar Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Registrar</label>
            <select
              value={registrarFilter}
              onChange={(e) => setRegistrarFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="all">All Registrars</option>
              {uniqueRegistrars.map((reg) => (
                <option key={reg} value={reg}>
                  {REGISTRAR_LABELS[reg] ?? reg}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters button */}
          <div>
            <button
              type="button"
              disabled={activeFiltersCount === 0}
              onClick={resetFilters}
              className={cn(
                "w-full rounded-lg border py-1.5 text-xs font-semibold transition-colors",
                activeFiltersCount > 0
                  ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 cursor-pointer"
                  : "border-border bg-muted/40 text-muted-foreground cursor-not-allowed"
              )}
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        viewMode === "list" ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )
      ) : error ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          {tab === "watchlist" ? (
            <>
              <Star className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Your watchlist is empty. Tap the ☆ on any IPO to track it here.
              </p>
            </>
          ) : query ? (
            <>
              <Search className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No IPOs match "{query}".
              </p>
            </>
          ) : (
            <>
              <CalendarRange className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No {board !== "all" ? `${board} ` : ""}IPOs in this category right now.
              </p>
            </>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-2">
          <IPOCalendarListHeader />
          {visible.map((ipo) => (
            <IPOCalendarListRow key={ipo.id} ipo={ipo} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((ipo) => (
            <IPOCalendarCard key={ipo.id} ipo={ipo} />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Showing {visible.length} of {data.total} · <UpdatedAgo lastUpdated={data.lastUpdated} />
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            {data.dataSource === "live" ? (
              <>
                Data via{" "}
                {data.credit?.url ? (
                  <a
                    href={data.credit.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                  >
                    {data.credit.name}
                  </a>
                ) : (
                  data.credit?.name ?? "live market sources"
                )}
              </>
            ) : (
              <>Sample data shown — live source unavailable.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
