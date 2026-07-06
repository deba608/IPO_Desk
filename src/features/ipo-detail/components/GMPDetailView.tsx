"use client";

import { useEffect, useState, useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { GMPEntry } from "@/types/calendar.types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GMPDetailViewProps {
  ipoId: string;
  capPrice: number;
}

interface ChartDataPoint {
  date: string;
  gmp: number;
  gainPercent?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

// GMP dates are IST calendar dates — anchor the parse to +05:30 and format in
// Asia/Kolkata so they don't shift a day for non-IST servers/viewers.
function fmtDate(iso: string, style: "short" | "long" = "short") {
  const d = new Date(iso + "T00:00:00+05:30");
  return style === "long"
    ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    : d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short" });
}

function fmtINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

/* ------------------------------------------------------------------ */
/*  Mini sparkline bar — used in each table row for visual weight      */
/* ------------------------------------------------------------------ */

function GmpBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (Math.abs(value) / max) * 100)) : 0;
  const isPositive = value >= 0;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          isPositive ? "bg-emerald-500/50" : "bg-rose-500/50"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Change pill                                                        */
/* ------------------------------------------------------------------ */

function ChangePill({ change }: { change: number | null }) {
  if (change === null) {
    return <span className="text-[11px] text-white/20">—</span>;
  }
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-medium text-white/40">
        <Minus className="h-3 w-3" /> 0
      </span>
    );
  }
  const positive = change > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        positive
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-rose-500/10 text-rose-400"
      }`}
    >
      {positive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {positive ? "+" : ""}
      {change}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary stat cards at the top                                      */
/* ------------------------------------------------------------------ */

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "rose" | "default";
}) {
  const colorMap = {
    emerald: "text-emerald-400",
    rose: "text-rose-400",
    default: "text-white/90",
  };
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-widest text-white/30">
        {label}
      </span>
      <span className={`text-sm font-bold ${colorMap[accent ?? "default"]}`}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function GMPDetailView({ ipoId, capPrice }: GMPDetailViewProps) {
  const [data, setData] = useState<ChartDataPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"table" | "chart">("table");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ipo/${encodeURIComponent(ipoId)}/gmp-history`)
      .then((r) => r.json())
      .then((json: { history: GMPEntry[] }) => {
        if (!cancelled) setData(json.history);
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ipoId]);

  // Derived data
  const { tableData, minGmp, maxGmp, absMax, netChange, highDate, lowDate } =
    useMemo(() => {
      if (!data || data.length === 0) {
        return {
          tableData: [] as ChartDataPoint[],
          minGmp: 0,
          maxGmp: 0,
          absMax: 0,
          netChange: 0,
          highDate: "",
          lowDate: "",
        };
      }
      const reversed = [...data].reverse();
      const mins = Math.min(...data.map((d) => d.gmp));
      const maxs = Math.max(...data.map((d) => d.gmp));
      const highEntry = data.find((d) => d.gmp === maxs);
      const lowEntry = data.find((d) => d.gmp === mins);
      return {
        tableData: reversed,
        minGmp: mins,
        maxGmp: maxs,
        absMax: Math.max(Math.abs(mins), Math.abs(maxs)),
        netChange: data[data.length - 1].gmp - data[0].gmp,
        highDate: highEntry?.date ?? "",
        lowDate: lowEntry?.date ?? "",
      };
    }, [data]);

  /* Loading state */
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  /* Empty state */
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] py-10">
        <BarChart3 className="h-8 w-8 text-white/15" />
        <p className="text-sm text-white/40">
          GMP history not available yet — data appears once daily snapshots are collected.
        </p>
      </div>
    );
  }

  /* Chart domain */
  const padding = Math.max((maxGmp - minGmp) * 0.15, 10);
  const yMin = Math.max(0, Math.floor(minGmp - padding));
  const yMax = Math.ceil(maxGmp + padding);

  const getChange = (index: number): number | null => {
    if (index >= tableData.length - 1) return null;
    return tableData[index].gmp - tableData[index + 1].gmp;
  };

  return (
    <div className="space-y-4">
      {/* ── Quick stats row ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Highest" value={fmtINR(maxGmp)} accent="emerald" />
        <MiniStat label="Lowest" value={fmtINR(minGmp)} accent={minGmp < 0 ? "rose" : "default"} />
        <MiniStat
          label="Net Change"
          value={`${netChange >= 0 ? "+" : ""}${fmtINR(netChange)}`}
          accent={netChange >= 0 ? "emerald" : "rose"}
        />
        <MiniStat label="Data Points" value={`${data.length} days`} />
      </div>

      {/* ── View toggle ─────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
        <button
          onClick={() => setActiveView("table")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
            activeView === "table"
              ? "bg-white/[0.08] text-white shadow-sm"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          Date-wise
        </button>
        {data.length >= 2 && (
          <button
            onClick={() => setActiveView("chart")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              activeView === "chart"
                ? "bg-white/[0.08] text-white shadow-sm"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Trend Chart
          </button>
        )}
      </div>

      {/* ── Table view ──────────────────────────────────── */}
      {activeView === "table" && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          {/* Header */}
          <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr] items-center gap-1 bg-white/[0.03] px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Date
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/25">
              GMP
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Est. Listing
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Change
            </span>
          </div>

          {/* Rows */}
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
            {tableData.map((entry, index) => {
              const change = getChange(index);
              const estListing = capPrice + entry.gmp;
              const gainPct =
                entry.gainPercent ??
                (capPrice > 0
                  ? Math.round((entry.gmp / capPrice) * 1000) / 10
                  : undefined);
              const isLatest = index === 0;
              const isHigh = entry.date === highDate;
              const isLow = entry.date === lowDate && data.length > 1;

              return (
                <div
                  key={entry.date}
                  className={`group grid grid-cols-[1.2fr_1fr_1fr_0.8fr] items-center gap-1 border-t border-white/[0.04] px-4 py-2 transition-colors duration-150 hover:bg-white/[0.03] ${
                    isLatest ? "bg-emerald-500/[0.03]" : ""
                  }`}
                  style={{
                    animationDelay: `${index * 20}ms`,
                  }}
                >
                  {/* Date */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`truncate text-[13px] ${
                        isLatest
                          ? "font-semibold text-white"
                          : "text-white/60 group-hover:text-white/80"
                      }`}
                    >
                      {fmtDate(entry.date)}
                    </span>
                    {isLatest && (
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                        Live
                      </span>
                    )}
                    {isHigh && !isLatest && (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-emerald-500/60">
                        High
                      </span>
                    )}
                    {isLow && !isLatest && minGmp !== maxGmp && (
                      <span className="shrink-0 rounded-full bg-rose-500/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-rose-500/60">
                        Low
                      </span>
                    )}
                  </div>

                  {/* GMP + bar */}
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-[13px] font-bold tabular-nums ${
                          entry.gmp > 0
                            ? "text-emerald-400"
                            : entry.gmp < 0
                              ? "text-rose-400"
                              : "text-white/50"
                        }`}
                      >
                        {entry.gmp > 0 ? "+" : ""}
                        {fmtINR(entry.gmp)}
                      </span>
                      {gainPct !== undefined && (
                        <span className="text-[10px] tabular-nums text-white/25">
                          {gainPct}%
                        </span>
                      )}
                    </div>
                    <GmpBar value={entry.gmp} max={absMax} />
                  </div>

                  {/* Est. listing */}
                  <div className="text-right">
                    <span className="text-[13px] tabular-nums text-white/50">
                      {fmtINR(estListing)}
                    </span>
                  </div>

                  {/* Day-over-day change */}
                  <div className="flex justify-end">
                    <ChangePill change={change} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Chart view ──────────────────────────────────── */}
      {activeView === "chart" && data.length >= 2 && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 8, right: 12, left: -4, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="gmpGradientV2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => {
                    const d = new Date(v + "T00:00:00+05:30");
                    return d.toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                    });
                  }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `₹${v}`}
                  domain={[yMin, yMax]}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15, 23, 42, 0.95)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    fontSize: "12px",
                    padding: "8px 12px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  }}
                  itemStyle={{ color: "#34d399" }}
                  labelStyle={{
                    color: "rgba(255,255,255,0.9)",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                  formatter={(value, name) => {
                    if (name === "gmp") return [fmtINR(value as number), "GMP"];
                    return [value, name];
                  }}
                  labelFormatter={(label) => fmtDate(String(label), "long")}
                  cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="gmp"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#gmpGradientV2)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "#34d399",
                    stroke: "#0f172a",
                    strokeWidth: 2.5,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Chart legend */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-white/[0.04] pt-3">
            <span className="flex items-center gap-1.5 text-[11px] text-white/30">
              <TrendingUp className="h-3 w-3 text-emerald-400/60" />
              Peak: {fmtINR(maxGmp)}{" "}
              <span className="text-white/15">({fmtDate(highDate)})</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-white/30">
              <TrendingDown className="h-3 w-3 text-rose-400/60" />
              Low: {fmtINR(minGmp)}{" "}
              <span className="text-white/15">({fmtDate(lowDate)})</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
