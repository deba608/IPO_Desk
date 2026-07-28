"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Clock, Zap } from "lucide-react";
import { IPO, IPOListResponse } from "@/types/ipo.types";
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

/* ── Helpers ──────────────────────────────────────────────────────── */

/** SME IPOs contain "SME" in the name (standard SEBI naming convention). */
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

/* ── Filter tabs definition ───────────────────────────────────────── */
type FilterTab = "all" | "mainboard" | "sme";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all",       label: "All" },
  { id: "mainboard", label: "Mainboard" },
  { id: "sme",       label: "SME" },
];

/* ── Component ────────────────────────────────────────────────────── */
export function RecentIPOsFeed({ onSelect }: RecentIPOsFeedProps) {
  const [ipos, setIpos] = useState<IPO[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const fetchIPOs = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const res = await fetch(force ? "/api/ipos?refresh=true" : "/api/ipos");
      if (!res.ok) return;
      const data: IPOListResponse = await res.json();
      setIpos(data.ipos ?? []);
      setLastUpdated(data.lastUpdated ?? null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchIPOs(); }, [fetchIPOs]);

  /* Refresh the "X min ago" label every minute */
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  /* Counts per tab for badge rendering */
  const counts = useMemo(() => ({
    all:       ipos.length,
    mainboard: ipos.filter((i) => !isSME(i.name)).length,
    sme:       ipos.filter((i) =>  isSME(i.name)).length,
  }), [ipos]);

  /* Filtered + sorted list */
  const displayed = useMemo(() => {
    const filtered = ipos.filter((ipo) => {
      if (activeFilter === "mainboard") return !isSME(ipo.name);
      if (activeFilter === "sme")       return  isSME(ipo.name);
      return true;
    });
    return filtered
      .sort((a, b) => new Date(b.lastSyncedAt).getTime() - new Date(a.lastSyncedAt).getTime())
      .slice(0, 30);
  }, [ipos, activeFilter]);

  /* ── Loading skeleton ──────────────────────────────────────────── */
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

      {/* ── Top header bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-2.5">
        {/* Title */}
        <div className="flex items-center gap-2 shrink-0">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Live IPOs
          </span>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-card/40 p-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-200",
                activeFilter === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[9px] font-bold transition-colors",
                  activeFilter === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Freshness */}
        {lastUpdated && (
          <span
            className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground"
            title={new Date(lastUpdated).toLocaleString()}
          >
            <Clock className="h-3 w-3 shrink-0" />
            {tick >= 0 && null}
            synced {timeAgo(lastUpdated)}
          </span>
        )}

        {/* Refresh */}
        <button
          type="button"
          onClick={() => fetchIPOs(true)}
          disabled={refreshing}
          aria-label="Refresh IPO list"
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
        </button>
      </div>

      {/* ── Scrollable pill strip ───────────────────────────────────── */}
      {displayed.length > 0 ? (
        <div
          className="flex gap-2 overflow-x-auto pt-2"
          style={{ scrollbarWidth: "none" }}
        >
          {displayed.map((ipo) => {
            const c = REGISTRAR_COLORS[ipo.registrar] ?? REGISTRAR_COLORS.kfintech;
            return (
              <button
                key={ipo.id}
                type="button"
                onClick={() => onSelect?.(ipo)}
                title={`${ipo.name} — click to select`}
                className={cn(
                  "group flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5",
                  "text-xs font-medium transition-all duration-200",
                  "hover:scale-[1.03] hover:shadow-lg hover:shadow-primary/5",
                  c.bg, c.border, c.text
                )}
              >
                {/* Pulsing live dot */}
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-50", c.dot)} />
                  <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", c.dot)} />
                </span>

                {/* Name */}
                <span className="max-w-[150px] truncate">{ipo.name}</span>

                {/* Registrar badge */}
                <span className="shrink-0 rounded-sm bg-white/5 px-1.5 py-px text-[9px] uppercase tracking-wide opacity-60 group-hover:opacity-90 transition-opacity">
                  {REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            No {activeFilter === "sme" ? "SME" : "Mainboard"} IPOs currently active.
          </p>
        </div>
      )}
    </div>
  );
}
