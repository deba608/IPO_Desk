"use client";

import { useEffect, useState } from "react";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { GMPEntry } from "@/types/calendar.types";

interface GMPDetailViewProps {
  ipoId: string;
  capPrice: number;
}

interface ChartDataPoint {
  date: string;
  gmp: number;
  gainPercent?: number;
}

export function GMPDetailView({ ipoId, capPrice }: GMPDetailViewProps) {
  const [data, setData] = useState<ChartDataPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(false);

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

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (!data || data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        GMP history not available yet — data will appear once daily snapshots are
        collected.
      </p>
    );
  }

  // Reverse to show newest first in the table
  const tableData = [...data].reverse();

  // Calculate change from previous day for each entry
  const getChange = (index: number): number | null => {
    // index is in reversed array (newest first)
    // In original data, the next entry (older) would be index+1 in reversed
    if (index >= tableData.length - 1) return null;
    return tableData[index].gmp - tableData[index + 1].gmp;
  };

  // Chart calculations
  const minGmp = Math.min(...data.map((d) => d.gmp));
  const maxGmp = Math.max(...data.map((d) => d.gmp));
  const padding = Math.max((maxGmp - minGmp) * 0.15, 10);
  const yMin = Math.max(0, Math.floor(minGmp - padding));
  const yMax = Math.ceil(maxGmp + padding);

  return (
    <div className="space-y-4">
      {/* Date-wise GMP Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Date</span>
          <span className="w-20 text-right">GMP</span>
          <span className="w-20 text-right">Est. Listing</span>
          <span className="w-24 text-right">Change</span>
        </div>

        {/* Table Body */}
        <div className="max-h-[360px] overflow-y-auto">
          {tableData.map((entry, index) => {
            const change = getChange(index);
            const estListing = capPrice + entry.gmp;
            const gainPct =
              entry.gainPercent ??
              (capPrice > 0
                ? Math.round((entry.gmp / capPrice) * 1000) / 10
                : undefined);
            const d = new Date(entry.date + "T00:00:00");
            const dateStr = d.toLocaleDateString("en-IN", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            });
            const isLatest = index === 0;

            return (
              <div
                key={entry.date}
                className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-border/50 px-4 py-2.5 transition-colors hover:bg-muted/20 ${
                  isLatest ? "bg-emerald-500/5" : ""
                }`}
              >
                {/* Date */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm ${isLatest ? "font-semibold text-foreground" : "text-foreground/80"}`}
                  >
                    {dateStr}
                  </span>
                  {isLatest && (
                    <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      Latest
                    </span>
                  )}
                </div>

                {/* GMP Value */}
                <div className="w-20 text-right">
                  <span
                    className={`text-sm font-semibold ${entry.gmp >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {entry.gmp >= 0 ? "+" : ""}₹{entry.gmp}
                  </span>
                  {gainPct !== undefined && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({gainPct}%)
                    </span>
                  )}
                </div>

                {/* Est. Listing Price */}
                <div className="w-20 text-right">
                  <span className="text-sm text-foreground/70">
                    ₹{estListing.toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Change from previous day */}
                <div className="flex w-24 items-center justify-end gap-1">
                  {change !== null ? (
                    <>
                      {change > 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      ) : change < 0 ? (
                        <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          change > 0
                            ? "text-emerald-400"
                            : change < 0
                              ? "text-rose-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {change > 0 ? "+" : ""}
                        {change}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>
          {data.length} data point{data.length !== 1 ? "s" : ""} tracked
        </span>
        <span>·</span>
        <span>
          Range: ₹{minGmp} — ₹{maxGmp}
        </span>
        {data.length >= 2 && (
          <>
            <span>·</span>
            <span>
              Net change:{" "}
              <span
                className={`font-medium ${data[data.length - 1].gmp - data[0].gmp >= 0 ? "text-emerald-400" : "text-rose-400"}`}
              >
                {data[data.length - 1].gmp - data[0].gmp >= 0 ? "+" : ""}₹
                {data[data.length - 1].gmp - data[0].gmp}
              </span>
            </span>
          </>
        )}
      </div>

      {/* Collapsible Chart */}
      {data.length >= 2 && (
        <div className="rounded-lg border border-border">
          <button
            onClick={() => setShowChart(!showChart)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            <span>📈 GMP Trend Chart</span>
            {showChart ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showChart && (
            <div className="h-48 border-t border-border px-2 pb-3 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient
                      id="gmpGradientDetail"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#22c55e"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="#22c55e"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v + "T00:00:00");
                      return d.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      });
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                    tickFormatter={(v: number) => `₹${v}`}
                    domain={[yMin, yMax]}
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#f1f5f9", fontWeight: 600 }}
                    formatter={(value, name) => {
                      if (name === "gmp")
                        return [
                          `₹${(value as number).toLocaleString("en-IN")}`,
                          "GMP",
                        ];
                      return [value, name];
                    }}
                    labelFormatter={(label) => {
                      const d = new Date(String(label) + "T00:00:00");
                      return d.toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="gmp"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#gmpGradientDetail)"
                    dot={{ r: 2, fill: "#22c55e", strokeWidth: 0 }}
                    activeDot={{
                      r: 4,
                      fill: "#22c55e",
                      stroke: "#0f172a",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
