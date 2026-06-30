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
import type { GMPEntry } from "@/types/calendar.types";

interface GMPTrendChartProps {
  ipoId: string;
}

interface ChartDataPoint {
  date: string;
  gmp: number;
  gainPercent?: number;
}

export function GMPTrendChart({ ipoId }: GMPTrendChartProps) {
  const [data, setData] = useState<ChartDataPoint[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ipo/${encodeURIComponent(ipoId)}/gmp-history`)
      .then((r) => r.json())
      .then((json: { history: GMPEntry[] }) => {
        if (!cancelled) setData(json.history.reverse());
      })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ipoId]);

  const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (!data || data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        GMP history not available yet — data will appear once enough daily snapshots are collected.
      </p>
    );
  }

  const minGmp = Math.min(...data.map((d) => d.gmp));
  const maxGmp = Math.max(...data.map((d) => d.gmp));
  const padding = Math.max((maxGmp - minGmp) * 0.15, 10);
  const yMin = Math.max(0, Math.floor(minGmp - padding));
  const yMax = Math.ceil(maxGmp + padding);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="gmpGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
            tickFormatter={(v: string) => {
              const d = new Date(v + "T00:00:00");
              return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
            tickFormatter={(v: number) => `₹${v}`}
            domain={[yMin, yMax]}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: "13px",
            }}
            labelStyle={{ color: "#f1f5f9", fontWeight: 600 }}
            formatter={(value, name) => {
              if (name === "gmp") return [formatINR(value as number), "GMP"];
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
            fill="url(#gmpGradient)"
            dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#22c55e", stroke: "#0f172a", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
