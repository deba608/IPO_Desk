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
  Grid3X3,
  Wallet,
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
}

interface ChartDataPoint {
  date: string;
  gmp: number;
  gainPercent?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

// GMP dates are IST calendar dates — anchor the parse to +05:30 AND format in
// Asia/Kolkata, otherwise a non-IST server/viewer renders the previous day
// (this shifted dates on the UTC deploy host).
function fmtDate(iso: string, style: "short" | "long" = "short") {
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
        year: "numeric",
      });
}

function fmtINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtDateFull(iso: string) {
  const d = new Date(iso + "T00:00:00+05:30");
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Trend indicator (▲ ▼ —)                                           */
/* ------------------------------------------------------------------ */

function TrendIndicator({ change }: { change: number | null }) {
  if (change === null) return null;
  if (change > 0)
    return (
      <span className="ml-1 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-500/20">
        <ArrowUpRight className="h-3 w-3 text-emerald-400" />
      </span>
    );
  if (change < 0)
    return (
      <span className="ml-1 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-rose-500/20">
        <ArrowDownRight className="h-3 w-3 text-rose-400" />
      </span>
    );
  return (
    <span className="ml-1 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white/[0.06]">
      <Minus className="h-3 w-3 text-white/30" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary stat cards                                                 */
/* ------------------------------------------------------------------ */

function MiniStat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "rose" | "default";
}) {
  const colorMap = {
    emerald: "text-emerald-400",
    rose: "text-rose-400",
    default: "text-white/90",
  };
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent px-3.5 py-3">
      <div className="absolute right-2 top-2 text-white/[0.04]">
        {icon}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
        {label}
      </span>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${colorMap[accent ?? "default"]}`}>
        {value}
      </p>
      {sub && <p className="mt-px text-[10px] text-white/25">{sub}</p>}
    </div>
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
}: GMPDetailViewProps) {
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
    if (!data || data.length === 0) {
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
    }
    const reversed = [...data].reverse();
    const mins = Math.min(...data.map((d) => d.gmp));
    const maxs = Math.max(...data.map((d) => d.gmp));
    const highEntry = data.find((d) => d.gmp === maxs);
    const lowEntry = data.find((d) => d.gmp === mins);
    const latest = reversed[0]?.gmp ?? 0;
    return {
      tableData: reversed,
      minGmp: mins,
      maxGmp: maxs,
      netChange: data[data.length - 1].gmp - data[0].gmp,
      highDate: highEntry?.date ?? "",
      lowDate: lowEntry?.date ?? "",
      latestGmp: latest,
      latestEstProfit: latest * lotSize,
    };
  }, [data, lotSize]);

  /* Loading state */
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  /* Empty state */
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] py-10">
        <BarChart3 className="h-8 w-8 text-white/15" />
        <p className="text-sm text-white/40">
          GMP history not available yet — data appears once daily snapshots are
          collected.
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
      {/* ── Header bar ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-white/90">
            {ipoName} Day-wise GMP Trend
          </h3>
        </div>
        <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-white/40">
          {data.length} Day{data.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Quick stats ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat
          icon={<TrendingUp className="h-8 w-8" />}
          label="Highest GMP"
          value={fmtINR(maxGmp)}
          sub={highDate ? fmtDateFull(highDate) : undefined}
          accent="emerald"
        />
        <MiniStat
          icon={<TrendingDown className="h-8 w-8" />}
          label="Lowest GMP"
          value={fmtINR(minGmp)}
          sub={lowDate ? fmtDateFull(lowDate) : undefined}
          accent={minGmp < 0 ? "rose" : "default"}
        />
        <MiniStat
          icon={<Wallet className="h-8 w-8" />}
          label="Est. Profit/Lot"
          value={fmtINR(latestEstProfit)}
          sub={`${lotSize} shares × ${fmtINR(latestGmp)} GMP`}
          accent={latestEstProfit >= 0 ? "emerald" : "rose"}
        />
        <MiniStat
          icon={<BarChart3 className="h-8 w-8" />}
          label="Net Change"
          value={`${netChange >= 0 ? "+" : ""}${fmtINR(netChange)}`}
          sub={`Over ${data.length} day${data.length !== 1 ? "s" : ""}`}
          accent={netChange >= 0 ? "emerald" : "rose"}
        />
      </div>

      {/* ── View toggle ─────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        <button
          onClick={() => setActiveView("table")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${
            activeView === "table"
              ? "bg-primary/15 text-primary shadow-sm shadow-primary/10"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          Date-wise Data
        </button>
        {data.length >= 2 && (
          <button
            onClick={() => setActiveView("chart")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${
              activeView === "chart"
                ? "bg-primary/15 text-primary shadow-sm shadow-primary/10"
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
          {/* Responsive horizontal scroll wrapper */}
          <div className="overflow-x-auto">
            {/* Table header */}
            <div className="grid min-w-[640px] grid-cols-[130px_90px_100px_140px_110px_80px] items-center gap-px bg-white/[0.03] px-4 py-3">
              {[
                "GMP Date",
                "IPO Price",
                "GMP",
                "Est. Listing Price",
                "Est. Profit*",
                "Change",
              ].map((h) => (
                <span
                  key={h}
                  className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/25"
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Table rows */}
            <div className="max-h-[420px] overflow-y-auto">
              {tableData.map((entry, index) => {
                const change = getChange(index);
                const estListing = capPrice + entry.gmp;
                const gainPct =
                  entry.gainPercent ??
                  (capPrice > 0
                    ? Math.round((entry.gmp / capPrice) * 1000) / 10
                    : undefined);
                const estProfit = entry.gmp * lotSize;
                const isLatest = index === 0;
                const isHigh =
                  entry.date === highDate && data!.length > 1;
                const isLow =
                  entry.date === lowDate &&
                  data!.length > 1 &&
                  minGmp !== maxGmp;

                return (
                  <div
                    key={entry.date}
                    className={`group grid min-w-[640px] grid-cols-[130px_90px_100px_140px_110px_80px] items-center gap-px border-t border-white/[0.04] px-4 py-2.5 transition-colors duration-150 hover:bg-white/[0.025] ${
                      isLatest
                        ? "bg-emerald-500/[0.04]"
                        : isHigh
                          ? "bg-emerald-500/[0.02]"
                          : isLow
                            ? "bg-rose-500/[0.02]"
                            : ""
                    }`}
                  >
                    {/* GMP Date */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[13px] tabular-nums ${
                          isLatest
                            ? "font-semibold text-white"
                            : "text-white/55 group-hover:text-white/75"
                        }`}
                      >
                        {fmtDate(entry.date)}
                      </span>
                      {isLatest && (
                        <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </span>
                          Live
                        </span>
                      )}
                    </div>

                    {/* IPO Price (Cap Price) */}
                    <span className="text-[13px] tabular-nums text-white/40">
                      {fmtINR(capPrice)}
                    </span>

                    {/* GMP */}
                    <div className="flex items-center">
                      <span
                        className={`text-[13px] font-bold tabular-nums ${
                          entry.gmp > 0
                            ? "text-emerald-400"
                            : entry.gmp < 0
                              ? "text-rose-400"
                              : "text-white/40"
                        }`}
                      >
                        {fmtINR(entry.gmp)}
                      </span>
                      <TrendIndicator change={change} />
                    </div>

                    {/* Est. Listing Price (Cap + GMP) (%) */}
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`text-[13px] font-semibold tabular-nums ${
                          entry.gmp >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {fmtINR(estListing)}
                      </span>
                      {gainPct !== undefined && (
                        <span
                          className={`text-[10px] tabular-nums ${
                            gainPct >= 0
                              ? "text-emerald-500/60"
                              : "text-rose-500/60"
                          }`}
                        >
                          ({gainPct.toFixed(2)}%)
                        </span>
                      )}
                    </div>

                    {/* Est. Profit per lot */}
                    <span
                      className={`text-[13px] font-semibold tabular-nums ${
                        estProfit > 0
                          ? "text-emerald-400"
                          : estProfit < 0
                            ? "text-rose-400"
                            : "text-white/40"
                      }`}
                    >
                      {fmtINR(estProfit)}
                    </span>

                    {/* Day-over-day change */}
                    <div className="flex items-center">
                      {change !== null ? (
                        <span
                          className={`text-[12px] font-medium tabular-nums ${
                            change > 0
                              ? "text-emerald-400"
                              : change < 0
                                ? "text-rose-400"
                                : "text-white/30"
                          }`}
                        >
                          {change > 0 ? "+" : ""}
                          {change}
                        </span>
                      ) : (
                        <span className="text-[11px] text-white/20">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table footer */}
          <div className="flex items-center gap-1.5 border-t border-white/[0.06] bg-white/[0.02] px-4 py-2">
            <Info className="h-3 w-3 shrink-0 text-white/20" />
            <p className="text-[10px] text-white/30">
              * Estimated Profit/Loss per lot = GMP × {lotSize} shares (Market
              Lot). GMP is unofficial and volatile — for reference only.
            </p>
          </div>
        </div>
      )}

      {/* ── Chart view ──────────────────────────────────── */}
      {activeView === "chart" && data.length >= 2 && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-transparent">
          <div className="h-60 p-4 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 8, right: 12, left: -4, bottom: 4 }}
              >
                <defs>
                  <linearGradient
                    id="gmpGradientV2"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#34d399"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="100%"
                      stopColor="#34d399"
                      stopOpacity={0}
                    />
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
                    padding: "10px 14px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  }}
                  itemStyle={{ color: "#34d399" }}
                  labelStyle={{
                    color: "rgba(255,255,255,0.9)",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                  formatter={(value, name) => {
                    if (name === "gmp") {
                      const v = value as number;
                      const profit = v * lotSize;
                      return [
                        `${fmtINR(v)}  •  Est. Profit: ${fmtINR(profit)}`,
                        "GMP",
                      ];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => fmtDate(String(label), "long")}
                  cursor={{
                    stroke: "rgba(255,255,255,0.08)",
                    strokeWidth: 1,
                  }}
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
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 border-t border-white/[0.04] px-4 py-2.5">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span className="flex items-center gap-1.5 text-[11px] text-white/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Peak: {fmtINR(maxGmp)}{" "}
                <span className="text-white/15">({fmtDate(highDate)})</span>
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-white/30">
                <span className="h-2 w-2 rounded-full bg-rose-400/60" />
                Low: {fmtINR(minGmp)}{" "}
                <span className="text-white/15">({fmtDate(lowDate)})</span>
              </span>
            </div>
            <span className="text-[10px] text-white/15">
              Lot Size: {lotSize} shares
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
