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
  Info,
} from "lucide-react";
import type { GMPEntry } from "@/types/calendar.types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GMPDetailViewProps {
  ipoId: string;
  ipoName: string;
  capPrice: number;
  lotSize: number;
  gmpUpdatedAt?: string;
  /** Live intraday GMP band low (seller "↓" rate), in INR. */
  gmpMin?: number;
  /** Live intraday GMP band high (buyer "↑" rate), in INR. */
  gmpMax?: number;
}

interface ChartDataPoint {
  date: string;
  gmp: number;
  gainPercent?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtDate(iso: string, style: "compact" | "long" = "compact") {
  const d = new Date(iso + "T00:00:00+05:30");
  return style === "long"
    ? d.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : d.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
      });
}

function fmtINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

/* ------------------------------------------------------------------ */
/*  Trend indicator                                                    */
/* ------------------------------------------------------------------ */

function TrendDot({ change }: { change: number | null }) {
  if (change === null) return null;
  if (change > 0)
    return (
      <span className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full bg-emerald-500/20">
        <ArrowUpRight className="h-2.5 w-2.5 text-emerald-400" />
      </span>
    );
  if (change < 0)
    return (
      <span className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full bg-rose-500/20">
        <ArrowDownRight className="h-2.5 w-2.5 text-rose-400" />
      </span>
    );
  return (
    <span className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full bg-white/[0.06]">
      <Minus className="h-2.5 w-2.5 text-white/30" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function GMPDetailView({
  ipoId,
  ipoName,
  capPrice,
  lotSize,
  gmpUpdatedAt,
  gmpMin,
  gmpMax,
}: GMPDetailViewProps) {
  const [data, setData] = useState<ChartDataPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"table" | "chart">("table");
  const [rangeFilter, setRangeFilter] = useState<7 | 14 | "all">("all");

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

  const {
    tableData,
    minGmp,
    maxGmp,
    netChange,
    highDate,
    lowDate,
    latestGmp,
    latestEstProfit,
  } = useMemo(() => {
    if (!data || data.length === 0)
      return {
        tableData: [] as ChartDataPoint[],
        minGmp: 0,
        maxGmp: 0,
        netChange: 0,
        highDate: "",
        lowDate: "",
        latestGmp: 0,
        latestEstProfit: 0,
      };

    // Apply range filter: data is oldest-first, so slice from the end.
    const rangeSlice =
      rangeFilter === "all"
        ? data
        : data.slice(-rangeFilter);

    const reversed = [...rangeSlice].reverse();
    const mins = Math.min(...rangeSlice.map((d) => d.gmp));
    const maxs = Math.max(...rangeSlice.map((d) => d.gmp));
    const latest = reversed[0]?.gmp ?? 0;
    return {
      tableData: reversed,
      minGmp: mins,
      maxGmp: maxs,
      netChange: rangeSlice[rangeSlice.length - 1].gmp - rangeSlice[0].gmp,
      highDate: rangeSlice.find((d) => d.gmp === maxs)?.date ?? "",
      lowDate: rangeSlice.find((d) => d.gmp === mins)?.date ?? "",
      latestGmp: latest,
      latestEstProfit: latest * lotSize,
    };
  }, [data, lotSize, rangeFilter]);

  // Chart data respects range filter (oldest-first for Recharts).
  // Must be declared here (before any early returns) to satisfy the Rules of Hooks.
  const chartData = useMemo(() => {
    if (!data) return [];
    return rangeFilter === "all" ? data : data.slice(-rangeFilter);
  }, [data, rangeFilter]);

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.08] py-6">
        <BarChart3 className="h-4 w-4 text-white/15" />
        <p className="text-[11px] text-white/35">
          GMP history not available yet — data appears once snapshots are collected.
        </p>
      </div>
    );
  }

  const padding = Math.max((maxGmp - minGmp) * 0.15, 10);
  const yMin = Math.max(0, Math.floor(minGmp - padding));
  const yMax = Math.ceil(maxGmp + padding);

  const getChange = (idx: number): number | null =>
    idx >= tableData.length - 1
      ? null
      : tableData[idx].gmp - tableData[idx + 1].gmp;

  const estListingNow = capPrice + latestGmp;
  const gainPctNow =
    capPrice > 0 ? Math.round((latestGmp / capPrice) * 1000) / 10 : 0;

  return (
    <div className="space-y-2.5">
      {/* ── Inline summary bar ────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <span className="text-white/35">
            Cap <span className="font-semibold text-white/65">{fmtINR(capPrice)}</span>
          </span>
          <span className="text-white/35">
            GMP{" "}
            <span className="font-bold text-emerald-400">
              +{fmtINR(latestGmp)}
            </span>
            {gmpMin !== undefined && gmpMax !== undefined && (
              <span
                className="ml-1 text-[10px] text-white/30"
                title="Live grey-market seller (↓) / buyer (↑) rate"
              >
                ({fmtINR(gmpMin)}↓ / {fmtINR(gmpMax)}↑)
              </span>
            )}
          </span>
          <span className="text-white/35">
            Listing{" "}
            <span className="font-semibold text-white/65">
              {fmtINR(estListingNow)}
              <span className="ml-0.5 text-emerald-500/60">
                ({gainPctNow}%)
              </span>
            </span>
          </span>
          <span className="text-white/35">
            Profit/Lot{" "}
            <span
              className={`font-bold ${latestEstProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}
            >
              {fmtINR(latestEstProfit)}
            </span>
          </span>
        </div>

        {/* View toggle + day count + range filter */}
        <div className="flex items-center gap-1.5">
          {gmpUpdatedAt && (
            <span className="hidden text-[9px] text-white/20 sm:inline">
              {new Date(gmpUpdatedAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}

          {/* Range filter */}
          {data.length > 7 && (
            <div className="flex items-center rounded-md border border-white/[0.06] bg-white/[0.02] p-px">
              {([7, 14, "all"] as const).map((r) => (
                <button
                  key={String(r)}
                  onClick={() => setRangeFilter(r)}
                  className={`rounded-[5px] px-1.5 py-0.5 text-[9px] transition-all ${
                    rangeFilter === r
                      ? "bg-primary/15 text-primary"
                      : "text-white/25 hover:text-white/45"
                  }`}
                >
                  {r === "all" ? "All" : `${r}d`}
                </button>
              ))}
            </div>
          )}

          <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-1.5 py-px text-[9px] tabular-nums text-white/25">
            {tableData.length}d
          </span>
          {data.length >= 2 && (
            <div className="flex items-center rounded-md border border-white/[0.06] bg-white/[0.02] p-px">
              <button
                onClick={() => setActiveView("table")}
                className={`rounded-[5px] px-1.5 py-0.5 transition-all ${
                  activeView === "table"
                    ? "bg-primary/15 text-primary"
                    : "text-white/25 hover:text-white/45"
                }`}
              >
                <Calendar className="h-3 w-3" />
              </button>
              <button
                onClick={() => setActiveView("chart")}
                className={`rounded-[5px] px-1.5 py-0.5 transition-all ${
                  activeView === "chart"
                    ? "bg-primary/15 text-primary"
                    : "text-white/25 hover:text-white/45"
                }`}
              >
                <BarChart3 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Table view ──────────────────────────────────── */}
      {activeView === "table" && (
        <div className="overflow-hidden rounded-lg border border-white/[0.05]">
          <div className="overflow-x-auto">
            {/* Header */}
            <div className="grid min-w-[540px] grid-cols-[1fr_68px_80px_100px_80px_56px] items-center bg-white/[0.025] px-3 py-1.5">
              {["Date", "Price", "GMP", "Est. Listing", "Profit*", "Δ"].map(
                (h) => (
                  <span
                    key={h}
                    className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/18"
                  >
                    {h}
                  </span>
                )
              )}
            </div>

            {/* Rows — tighter vertical rhythm */}
            <div className="max-h-[240px] overflow-y-auto">
              {tableData.map((entry, idx) => {
                const change = getChange(idx);
                const estListing = capPrice + entry.gmp;
                const gainPct =
                  entry.gainPercent ??
                  (capPrice > 0
                    ? Math.round((entry.gmp / capPrice) * 1000) / 10
                    : undefined);
                const estProfit = entry.gmp * lotSize;
                const isLatest = idx === 0;
                const isHigh = entry.date === highDate && data!.length > 1;
                const isLow =
                  entry.date === lowDate &&
                  data!.length > 1 &&
                  minGmp !== maxGmp;

                return (
                  <div
                    key={entry.date}
                    className={`group grid min-w-[540px] grid-cols-[1fr_68px_80px_100px_80px_56px] items-center border-t border-white/[0.03] px-3 py-[6px] transition-colors hover:bg-white/[0.02] ${
                      isLatest ? "bg-emerald-500/[0.03]" : ""
                    }`}
                  >
                    {/* Date */}
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[11px] tabular-nums ${
                          isLatest
                            ? "font-semibold text-white"
                            : "text-white/45"
                        }`}
                      >
                        {fmtDate(entry.date)}
                      </span>
                      {isLatest && (
                        <span className="flex items-center gap-px rounded-full bg-emerald-500/15 px-1 text-[7px] font-bold uppercase tracking-wider text-emerald-400">
                          <span className="relative flex h-1 w-1">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-1 w-1 rounded-full bg-emerald-400" />
                          </span>
                          Live
                        </span>
                      )}
                      {isHigh && !isLatest && (
                        <span className="rounded bg-emerald-500/10 px-0.5 text-[7px] font-bold text-emerald-500/50">
                          H
                        </span>
                      )}
                      {isLow && !isLatest && (
                        <span className="rounded bg-rose-500/10 px-0.5 text-[7px] font-bold text-rose-500/50">
                          L
                        </span>
                      )}
                    </div>

                    {/* IPO Price */}
                    <span className="text-[11px] tabular-nums text-white/25">
                      {fmtINR(capPrice)}
                    </span>

                    {/* GMP + dot */}
                    <div className="flex items-center gap-0.5">
                      <span
                        className={`text-[11px] font-bold tabular-nums ${
                          entry.gmp > 0
                            ? "text-emerald-400"
                            : entry.gmp < 0
                              ? "text-rose-400"
                              : "text-white/30"
                        }`}
                      >
                        {fmtINR(entry.gmp)}
                      </span>
                      <TrendDot change={change} />
                    </div>

                    {/* Est. Listing (%) */}
                    <div className="flex items-baseline gap-0.5">
                      <span
                        className={`text-[11px] font-semibold tabular-nums ${
                          entry.gmp >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {fmtINR(estListing)}
                      </span>
                      {gainPct !== undefined && (
                        <span className="text-[8px] tabular-nums text-white/18">
                          ({gainPct.toFixed(1)}%)
                        </span>
                      )}
                    </div>

                    {/* Profit */}
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        estProfit > 0
                          ? "text-emerald-400"
                          : estProfit < 0
                            ? "text-rose-400"
                            : "text-white/30"
                      }`}
                    >
                      {fmtINR(estProfit)}
                    </span>

                    {/* Change */}
                    <span
                      className={`text-[10px] tabular-nums ${
                        change === null
                          ? "text-white/12"
                          : change > 0
                            ? "text-emerald-400"
                            : change < 0
                              ? "text-rose-400"
                              : "text-white/20"
                      }`}
                    >
                      {change === null
                        ? "—"
                        : `${change > 0 ? "+" : ""}${change}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.04] bg-white/[0.01] px-3 py-1">
            <div className="flex items-center gap-1">
              <Info className="h-2.5 w-2.5 text-white/12" />
              <span className="text-[8px] text-white/20">
                * Profit = GMP × {lotSize} shares · Not investment advice
              </span>
            </div>
            <div className="flex items-center gap-2 text-[8px] text-white/18">
              <span>H:{fmtINR(maxGmp)}</span>
              <span>L:{fmtINR(minGmp)}</span>
              <span
                className={
                  netChange >= 0 ? "text-emerald-500/40" : "text-rose-500/40"
                }
              >
                Δ{netChange >= 0 ? "+" : ""}
                {netChange}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Chart view ──────────────────────────────────── */}
      {activeView === "chart" && chartData.length >= 2 && (
        <div className="overflow-hidden rounded-lg border border-white/[0.05] bg-gradient-to-br from-white/[0.015] to-transparent">
          <div className="h-48 p-2.5 pb-0.5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 6, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="gmpGradientV2"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.03)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 8, fill: "rgba(255,255,255,0.18)" }}
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
                  tick={{ fontSize: 8, fill: "rgba(255,255,255,0.18)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `₹${v}`}
                  domain={[yMin, yMax]}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15, 23, 42, 0.95)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "10px",
                    padding: "5px 8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                  }}
                  itemStyle={{ color: "#34d399" }}
                  labelStyle={{
                    color: "rgba(255,255,255,0.8)",
                    fontWeight: 600,
                    marginBottom: "2px",
                    fontSize: "9px",
                  }}
                  formatter={(value, name) => {
                    if (name === "gmp") {
                      const v = value as number;
                      return [
                        `${fmtINR(v)} · Profit: ${fmtINR(v * lotSize)}`,
                        "GMP",
                      ];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => fmtDate(String(label), "long")}
                  cursor={{
                    stroke: "rgba(255,255,255,0.05)",
                    strokeWidth: 1,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="gmp"
                  stroke="#34d399"
                  strokeWidth={1.5}
                  fill="url(#gmpGradientV2)"
                  dot={false}
                  activeDot={{
                    r: 3.5,
                    fill: "#34d399",
                    stroke: "#0f172a",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.03] px-2.5 py-1 text-[8px] text-white/18">
            <div className="flex gap-2.5">
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                Peak {fmtINR(maxGmp)}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-rose-400/60" />
                Low {fmtINR(minGmp)}
              </span>
            </div>
            <span>Lot: {lotSize}</span>
          </div>
        </div>
      )}
    </div>
  );
}
