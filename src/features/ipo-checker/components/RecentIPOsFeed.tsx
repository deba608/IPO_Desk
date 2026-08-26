"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Clock } from "lucide-react";
import { IPO, IPOListResponse } from "@/types/ipo.types";
import { CalendarResponse, IPOLifecycle } from "@/types/calendar.types";
import { cn } from "@/lib/utils";

interface RecentIPOsFeedProps {
  onSelect?: (ipo: IPO) => void;
}

/* ── Registrar colour palette ─────────────────────────────────────── */
const REGISTRAR_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  kfintech:   { bg: "bg-indigo-500/10",  border: "border-indigo-500/25",  text: "text-indigo-400",  dot: "bg-indigo-400" },
  linkintime: { bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400",    dot: "bg-blue-400" },
  bigshare:   { bg: "bg-violet-500/10",  border: "border-violet-500/25",  text: "text-violet-400",  dot: "bg-violet-400" },
  mufg:       { bg: "bg-cyan-500/10",    border: "border-cyan-500/25",    text: "text-cyan-400",    dot: "bg-cyan-400" },
};

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech:   "KFin",
  mufg:       "MUFG",
  linkintime: "LinkIn",
  bigshare:   "Bigshare",
};

/* ── Lifecycle chip styling ───────────────────────────────────────── */
const LIFECYCHIP_STYLES: Record<IPOLifecycle, string> = {
  open:     "bg-emerald-500/15 text-emerald-400",
  upcoming: "bg-amber-500/15 text-amber-400",
  closed:   "bg-slate-500/15 text-slate-400",
  listed:   "bg-sky-500/15 text-sky-400",
};

const LIFECYCLE_LABELS: Record<IPOLifecycle, string> = {
  open:     "Open",
  upcoming: "Opens",
  closed:   "Closed",
  listed:   "Listed",
};

function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/** Short label for a pill's status chip, e.g. "Opens 12 Aug" / "Open". */
function lifecycleChip(ipo: EnrichedIPO): string {
  const base = ipo.lifecycle ? LIFECYCLE_LABELS[ipo.lifecycle] : undefined;
  if (!base) return "";
  // Show the date for upcoming issues (when it opens is the useful signal);
  // open/closed/listed states are self-explanatory on their own.
  if (ipo.lifecycle === "upcoming" && ipo.openDate) {
    return `${base} ${formatDay(ipo.openDate)}`;
  }
  return base;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function isSME(name: string): boolean {
  return /\bSME\b/i.test(name);
}

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Normalise a name for fuzzy matching — strip suffixes, punctuation, case */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|ipo|pvt|private|sme)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/* ── Filter tabs ──────────────────────────────────────────────────── */
type FilterTab = "all" | "mainboard" | "sme";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all",       label: "All" },
  { id: "mainboard", label: "Mainboard" },
  { id: "sme",       label: "SME" },
];

/* ── Enriched IPO (IPO + calendar context for the status chip) ────── */
interface EnrichedIPO extends IPO {
  openDate?: string; // yyyy-mm-dd from calendar, used for sort
  lifecycle?: IPOLifecycle;
}

/* ── Component ────────────────────────────────────────────────────── */
export function RecentIPOsFeed({ onSelect }: RecentIPOsFeedProps) {
  const [ipos, setIpos] = useState<IPO[]>([]);
  const [calendarMap, setCalendarMap] = useState<
    Record<string, { openDate: string; lifecycle?: IPOLifecycle }>
  >({}); // normName → calendar context
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const fetchIPOs = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      // Fetch active IPO list + calendar in parallel. The server-side
      // catalogue cache (60s TTL) keeps both fresh; no secret-gated refresh.
      const [ipoRes, calRes] = await Promise.allSettled([
        fetch("/api/ipos"),
        fetch("/api/calendar"),
      ]);

      if (ipoRes.status === "fulfilled" && ipoRes.value.ok) {
        const data: IPOListResponse = await ipoRes.value.json();
        setIpos(data.ipos ?? []);
        setLastUpdated(data.lastUpdated ?? null);
      }

      // Build name → calendar context lookup
      if (calRes.status === "fulfilled" && calRes.value.ok) {
        const cal: CalendarResponse = await calRes.value.json();
        const map: Record<string, { openDate: string; lifecycle?: IPOLifecycle }> = {};
        for (const entry of cal.ipos ?? []) {
          if (entry.openDate) {
            map[normaliseName(entry.name)] = {
              openDate: entry.openDate,
              lifecycle: entry.lifecycle,
            };
          }
        }
        setCalendarMap(map);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState fires after await
  useEffect(() => { fetchIPOs(); }, [fetchIPOs]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  /* Counts per tab */
  const counts = useMemo(() => ({
    all:       ipos.length,
    mainboard: ipos.filter((i) => !isSME(i.name)).length,
    sme:       ipos.filter((i) =>  isSME(i.name)).length,
  }), [ipos]);

  /* Enrich + filter + sort by openDate descending (latest first) */
  const displayed = useMemo((): EnrichedIPO[] => {
    const enriched: EnrichedIPO[] = ipos.map((ipo) => ({
      ...ipo,
      openDate: calendarMap[normaliseName(ipo.name)]?.openDate,
      lifecycle: calendarMap[normaliseName(ipo.name)]?.lifecycle,
    }));

    const filtered = enriched.filter((ipo) => {
      if (activeFilter === "mainboard") return !isSME(ipo.name);
      if (activeFilter === "sme")       return  isSME(ipo.name);
      return true;
    });

    return [...filtered]
      .sort((a, b) => {
        // Both have calendar dates → sort newest openDate first
        if (a.openDate && b.openDate) {
          return b.openDate.localeCompare(a.openDate);
        }
        // One has a date → date-enriched floats to top
        if (a.openDate) return -1;
        if (b.openDate) return 1;
        // Neither has a date → preserve source order (registrar's native newest-first)
        return 0;
      })
      .slice(0, 30);
  }, [ipos, calendarMap, activeFilter]);

  /* ── Loading state ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground">Loading active IPOs…</span>
      </div>
    );
  }

  if (ipos.length === 0) return null;

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-2.5">
        {/* Title */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Live IPOs
          </span>
        </div>

        <div className="flex-1" />

        {/* Freshness */}
        {lastUpdated && (
          <span
            className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground"
            title={new Date(lastUpdated).toLocaleString()}
          >
            <Clock className="h-3 w-3 shrink-0" />
            synced {timeAgo(lastUpdated)}
          </span>
        )}

        {/* Refresh */}
        <button
          type="button"
          onClick={() => fetchIPOs(true)}
          disabled={refreshing}
          aria-label="Refresh IPO list"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-all hover:border-primary/50 hover:text-primary hover:bg-primary/5 active:scale-90 disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
        </button>

        {/* Filter tabs — pill group */}
        <div className="flex items-center rounded-lg border border-border bg-muted/20 p-0.5">
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                aria-pressed={active}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-200 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-primary/60",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[9px] font-bold transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "bg-transparent text-muted-foreground/50"
                  )}
                >
                  {counts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Pill strip ─────────────────────────────────────────────── */}
      {displayed.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pt-1 pb-1" style={{ scrollbarWidth: "none" }}>
          {displayed.map((ipo) => {
            const c = REGISTRAR_COLORS[ipo.registrar] ?? REGISTRAR_COLORS.kfintech;
            return (
              <button
                key={ipo.id}
                type="button"
                onClick={() => onSelect?.(ipo)}
                title={ipo.openDate
                  ? `${ipo.name} · opened ${formatDay(ipo.openDate)} · click to select`
                  : `${ipo.name} · click to select`}
                className={cn(
                  "group flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5",
                  "text-xs font-medium transition-all duration-200 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-primary/60",
                  "hover:shadow-lg hover:shadow-primary/5 hover:brightness-110",
                  c.bg, c.border, c.text
                )}
              >
                {/* Registrar dot — static colour identity (no ping: 30
                    simultaneous animations is noise and burns paint) */}
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", c.dot)}
                />

                <span className="max-w-[150px] truncate">{ipo.name}</span>

                {/* Lifecycle chip — tells the user where the issue actually is */}
                {ipo.lifecycle && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold leading-4",
                      LIFECYCHIP_STYLES[ipo.lifecycle]
                    )}
                  >
                    {lifecycleChip(ipo)}
                  </span>
                )}

                {/* Registrar badge */}
                <span className="shrink-0 rounded-sm bg-white/5 px-1.5 py-px text-[9px] uppercase tracking-wide opacity-60 transition-opacity group-hover:opacity-90">
                  {REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            No{" "}
            {activeFilter === "all" ? "" : activeFilter === "sme" ? "SME " : "Mainboard "}
            IPOs currently active.
          </p>
        </div>
      )}
    </div>
  );
}
