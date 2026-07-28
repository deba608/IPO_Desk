"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Clock, Zap, Building2 } from "lucide-react";
import { IPO, IPOListResponse } from "@/types/ipo.types";
import { cn } from "@/lib/utils";

interface RecentIPOsFeedProps {
  /** Called when the user clicks an IPO pill — lets the parent pre-select it. */
  onSelect?: (ipo: IPO) => void;
}

const REGISTRAR_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  kfintech:  { bg: "bg-indigo-500/10",  text: "text-indigo-400",  dot: "bg-indigo-400" },
  linkintime:{ bg: "bg-blue-500/10",    text: "text-blue-400",    dot: "bg-blue-400" },
  bigshare:  { bg: "bg-violet-500/10",  text: "text-violet-400",  dot: "bg-violet-400" },
  mufg:      { bg: "bg-cyan-500/10",    text: "text-cyan-400",    dot: "bg-cyan-400" },
};

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech: "KFin",
  mufg: "MUFG",
  linkintime: "LinkIn",
  bigshare: "Bigshare",
};

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

export function RecentIPOsFeed({ onSelect }: RecentIPOsFeedProps) {
  const [ipos, setIpos] = useState<IPO[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0); // force re-render for time-ago label

  const fetchIPOs = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const url = force ? "/api/ipos?refresh=true" : "/api/ipos";
      const res = await fetch(url);
      if (!res.ok) return;
      const data: IPOListResponse = await res.json();
      setIpos(data.ipos ?? []);
      setLastUpdated(data.lastUpdated ?? null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchIPOs();
  }, [fetchIPOs]);

  // Refresh the "X min ago" label every minute
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-2">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground">Loading active IPOs…</span>
      </div>
    );
  }

  if (ipos.length === 0) return null;

  // Show newest-first (lastSyncedAt descending) up to 20
  const recent = [...ipos]
    .sort((a, b) => new Date(b.lastSyncedAt).getTime() - new Date(a.lastSyncedAt).getTime())
    .slice(0, 20);

  return (
    <div className="animate-fade-up delay-100">
      {/* Header row */}
      <div className="mb-2 flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Zap className="h-3 w-3 text-amber-400" />
          Active IPOs
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            {ipos.length}
          </span>
        </span>

        {/* Freshness badge */}
        {lastUpdated && (
          <span
            className="ml-auto flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground"
            title={new Date(lastUpdated).toLocaleString()}
          >
            <Clock className="h-2.5 w-2.5" />
            {/* tick is intentionally consumed so React re-renders every minute */}
            {tick >= 0 && null}
            synced {timeAgo(lastUpdated)}
          </span>
        )}

        {/* Manual refresh */}
        <button
          type="button"
          onClick={() => fetchIPOs(true)}
          disabled={refreshing}
          aria-label="Refresh IPO list"
          className="flex items-center justify-center rounded-full border border-border bg-card p-1 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
        </button>
      </div>

      {/* Horizontally scrollable pill row */}
      <div className="relative">
        {/* fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent z-10" />

        <div className="flex gap-2 overflow-x-auto pb-1 pr-8" style={{ scrollbarWidth: "none" }}>
          {recent.map((ipo) => {
            const colors =
              REGISTRAR_COLORS[ipo.registrar] ?? REGISTRAR_COLORS.kfintech;
            return (
              <button
                key={ipo.id}
                type="button"
                onClick={() => onSelect?.(ipo)}
                title={`${ipo.name} · ${ipo.registrar} · Click to select`}
                className={cn(
                  "group flex shrink-0 items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  "hover:border-primary/40 hover:shadow-sm hover:shadow-primary/10",
                  colors.bg,
                  colors.text
                )}
              >
                {/* live pulse dot */}
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full animate-ping rounded-full opacity-40",
                      colors.dot
                    )}
                  />
                  <span
                    className={cn("relative inline-flex h-2 w-2 rounded-full", colors.dot)}
                  />
                </span>

                <span className="max-w-[160px] truncate">{ipo.name}</span>

                {/* registrar chip */}
                <span
                  className={cn(
                    "shrink-0 rounded-full border border-current/20 bg-current/10 px-1.5 py-px text-[9px] uppercase tracking-wide opacity-70 group-hover:opacity-100 transition-opacity"
                  )}
                >
                  {REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}
                </span>

                {/* building icon on hover */}
                <Building2 className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
