"use client";

import { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  BarChart3,
  Search,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  type TooltipPayloadEntry,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  BacktestCriteria,
  runBacktest,
  STRATEGY_PRESETS,
  exportBacktestToCsv,
} from "../lib/backtest.service";
import { HistoricalIPO } from "../data/historical-ipos";

export function BacktestWorkspace() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("high_gmp_momentum");

  const [criteria, setCriteria] = useState<BacktestCriteria>({
    minGmpPercent: 25,
    minQibSubscription: 10,
    minRetailSubscription: 0,
    minTotalSubscription: 0,
    board: "all",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof HistoricalIPO>("listingGainPercent");
  const [sortAsc, setSortAsc] = useState(false);

  // Run backtesting calculations
  const result = useMemo(() => {
    return runBacktest(criteria);
  }, [criteria]);

  // Timeline cumulative returns data for the chart
  const timelineChartData = useMemo(() => {
    let runningCapital = result.simulatedStartingCapital;
    const points = [
      {
        date: "Start",
        capital: result.simulatedStartingCapital,
        name: "Initial Capital",
        gain: 0,
      },
    ];

    for (const ipo of result.matchedIpos) {
      const pnl = 15000 * (ipo.listingGainPercent / 100);
      runningCapital += pnl;
      points.push({
        date: ipo.listingDate.slice(5), // MM-DD
        capital: Math.round(runningCapital),
        name: ipo.name,
        gain: ipo.listingGainPercent,
      });
    }

    return points;
  }, [result]);

  // Filtered & sorted table list
  const displayIpos = useMemo(() => {
    let list = [...result.matchedIpos];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.symbol.toLowerCase().includes(q) ||
          i.sector.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return list;
  }, [result.matchedIpos, searchQuery, sortField, sortAsc]);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = STRATEGY_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setCriteria({ ...preset.criteria });
    }
  };

  const handleCustomChange = <K extends keyof BacktestCriteria>(
    field: K,
    value: BacktestCriteria[K]
  ) => {
    setSelectedPresetId("custom");
    setCriteria((prev) => ({ ...prev, [field]: value }));
  };

  const handleDownloadCsv = () => {
    const csv = exportBacktestToCsv(result);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ipodesk-backtest-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    handleSelectPreset("high_gmp_momentum");
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card via-card to-background p-6 shadow-xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                <Sparkles className="mr-1 h-3 w-3" /> Strategy Simulation Engine
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {result.totalHistoricalIpos} Historical Listings Analyzed
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              IPO Strategy Backtester
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              Simulate quantitative listing-day rules against verified Indian mainboard and SME IPO historical data. Discover high-probability filters before bidding.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              disabled={result.matchedCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>

        {/* Strategy Presets Bar */}
        <div className="mt-6 border-t border-border/60 pt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Strategy Presets
          </p>
          <div className="flex flex-wrap gap-2">
            {STRATEGY_PRESETS.map((preset) => {
              const active = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`group relative flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-xs transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-sm"
                      : "border-border bg-card/60 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
                  }`}
                >
                  <div>
                    <span className="font-medium text-foreground">{preset.name}</span>
                    <span className="ml-2 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                      {preset.badge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main Layout: Controls Left / Metrics + Visuals Right ─ */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Parameter Filter Sliders (4 cols) */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-primary" /> Strategy Parameters
              </h2>
              {selectedPresetId === "custom" && (
                <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
                  Custom
                </Badge>
              )}
            </div>

            <div className="space-y-4 text-xs">
              {/* Board Selection */}
              <div>
                <label className="mb-1.5 block font-medium text-foreground">
                  Exchange Board
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["all", "mainboard", "sme"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => handleCustomChange("board", b)}
                      className={`rounded-lg border py-1.5 text-center capitalize transition-colors ${
                        criteria.board === b
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {b === "all" ? "All Boards" : b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min GMP % */}
              <div>
                <div className="flex justify-between font-medium">
                  <span className="text-foreground">Min. Expected GMP %</span>
                  <span className="font-mono text-primary font-bold">
                    {criteria.minGmpPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={criteria.minGmpPercent}
                  onChange={(e) =>
                    handleCustomChange("minGmpPercent", Number(e.target.value))
                  }
                  className="mt-2 w-full accent-primary cursor-pointer"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>0% (Any)</span>
                  <span>50%</span>
                  <span>100%+</span>
                </div>
              </div>

              {/* Min QIB Subscription */}
              <div>
                <div className="flex justify-between font-medium">
                  <span className="text-foreground">Min. QIB Subscription</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {criteria.minQibSubscription === 0
                      ? "Any (0x)"
                      : `${criteria.minQibSubscription}x`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={criteria.minQibSubscription}
                  onChange={(e) =>
                    handleCustomChange(
                      "minQibSubscription",
                      Number(e.target.value)
                    )
                  }
                  className="mt-2 w-full accent-emerald-500 cursor-pointer"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>0x</span>
                  <span>50x</span>
                  <span>100x+</span>
                </div>
              </div>

              {/* Min Retail Subscription */}
              <div>
                <div className="flex justify-between font-medium">
                  <span className="text-foreground">Min. Retail Subscription</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {criteria.minRetailSubscription === 0
                      ? "Any (0x)"
                      : `${criteria.minRetailSubscription}x`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="2"
                  value={criteria.minRetailSubscription}
                  onChange={(e) =>
                    handleCustomChange(
                      "minRetailSubscription",
                      Number(e.target.value)
                    )
                  }
                  className="mt-2 w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Min Total Subscription */}
              <div>
                <div className="flex justify-between font-medium">
                  <span className="text-foreground">Min. Total Subscription</span>
                  <span className="font-mono text-blue-400 font-bold">
                    {criteria.minTotalSubscription === 0
                      ? "Any (0x)"
                      : `${criteria.minTotalSubscription}x`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={criteria.minTotalSubscription}
                  onChange={(e) =>
                    handleCustomChange(
                      "minTotalSubscription",
                      Number(e.target.value)
                    )
                  }
                  className="mt-2 w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Issue Size minimum filter */}
              <div>
                <label className="mb-1.5 block font-medium text-foreground">
                  Min. Issue Size (Cr)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "Any", val: undefined },
                    { label: "≥ ₹500 Cr", val: 500 },
                    { label: "≥ ₹1,500 Cr", val: 1500 },
                  ].map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleCustomChange("minIssueSizeCr", s.val)}
                      className={`rounded-lg border py-1.5 text-center text-[11px] transition-colors ${
                        criteria.minIssueSizeCr === s.val
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground">
              <p className="flex items-center gap-1 font-medium text-foreground mb-1">
                <Info className="h-3.5 w-3.5 text-primary" /> How simulation works
              </p>
              Rule evaluates listings that met your minimum criteria at the time of issue closing. Simulated return assumes ₹15,000 retail lot allocation exited on listing day.
            </div>
          </div>
        </div>

        {/* Right Column: Key KPI Cards + Charts (8 cols) */}
        <div className="space-y-4 lg:col-span-8">
          {/* ── KPI Grid ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Win Rate */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Strategy Win Rate
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span
                  className={`text-2xl font-bold ${
                    result.winRatePercent >= 80
                      ? "text-emerald-400"
                      : result.winRatePercent >= 50
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {result.winRatePercent}%
                </span>
                <span className="text-[11px] text-muted-foreground">
                  ({result.winCount}W / {result.lossCount}L)
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Bench: {result.benchmarkWinRatePercent}% win rate
              </p>
            </div>

            {/* Avg Listing Gain */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Avg. Listing Day Gain
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span
                  className={`text-2xl font-bold ${
                    result.avgListingGainPercent >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {result.avgListingGainPercent >= 0 ? "+" : ""}
                  {result.avgListingGainPercent}%
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground flex items-center gap-0.5">
                <span
                  className={
                    result.alphaVsBenchmark >= 0
                      ? "text-emerald-400 font-medium"
                      : "text-rose-400 font-medium"
                  }
                >
                  {result.alphaVsBenchmark >= 0 ? "+" : ""}
                  {result.alphaVsBenchmark}%
                </span>{" "}
                vs market baseline
              </p>
            </div>

            {/* Simulated Capital Return */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Simulated Profit (₹1L Cap)
              </p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary">
                  {result.simulatedProfit >= 0 ? "+₹" : "-₹"}
                  {Math.abs(result.simulatedProfit).toLocaleString("en-IN")}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Ending: ₹{result.simulatedEndingCapital.toLocaleString("en-IN")} (
                {result.simulatedTotalReturnPercent}%)
              </p>
            </div>

            {/* Filtered Count */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Matching IPOs
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-foreground">
                  {result.matchedCount}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  / {result.totalHistoricalIpos} total
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {result.bestIpo
                  ? `Best: +${result.maxGainPercent}% (${result.bestIpo.symbol})`
                  : "No matches"}
              </p>
            </div>
          </div>

          {/* ── Charts: Return Distribution & Cumulative Growth ──── */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Listing Gain Distribution Histogram */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <BarChart3 className="h-3.5 w-3.5 text-primary" /> Listing Gain
                Distribution
              </h3>
              <div className="h-44 w-full">
                {result.matchedCount > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={result.distribution}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis
                        dataKey="range"
                        stroke="#737373"
                        fontSize={9}
                        tickLine={false}
                        interval={0}
                        tickFormatter={(val) => {
                          if (val.includes("< 0%")) return "< 0%";
                          if (val.includes("0% to 15%")) return "0-15%";
                          if (val.includes("15% to 50%")) return "15-50%";
                          if (val.includes("50% to 100%")) return "50-100%";
                          return "> 100%";
                        }}
                      />
                      <YAxis stroke="#737373" fontSize={9} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#171717",
                          borderColor: "#333333",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                        formatter={(val: number | string, _name: string, item: TooltipPayloadEntry) => [
                          `${val ?? 0} IPOs (${item?.payload?.percentage ?? 0}%)`,
                          "Count",
                        ]}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {result.distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No IPOs match the criteria
                  </div>
                )}
              </div>
            </div>

            {/* Cumulative Strategy Simulation Area Chart */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Capital Growth
                Trajectory
              </h3>
              <div className="h-44 w-full">
                {result.matchedCount > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={timelineChartData}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis dataKey="date" stroke="#737373" fontSize={9} />
                      <YAxis
                        stroke="#737373"
                        fontSize={9}
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#171717",
                          borderColor: "#333333",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                        formatter={(val: number | string, _name: string, item: TooltipPayloadEntry) => [
                          `₹${Number(val ?? 0).toLocaleString("en-IN")} (${item?.payload?.gain ? `+${item.payload.gain}%` : ""})`,
                          item?.payload?.name ?? "Capital",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="capital"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#capGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No timeline points available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Matching Historical IPOs Table ─────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Matching Historical Issues ({displayIpos.length})
            </h2>
            <Badge variant="outline" className="text-xs">
              2023 – 2026
            </Badge>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search company or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th
                  onClick={() => {
                    if (sortField === "name") setSortAsc(!sortAsc);
                    else {
                      setSortField("name");
                      setSortAsc(true);
                    }
                  }}
                  className="cursor-pointer py-3 pl-4 pr-3 font-semibold hover:text-foreground"
                >
                  IPO Name
                </th>
                <th className="py-3 px-3 font-semibold">Board / Sector</th>
                <th
                  onClick={() => {
                    if (sortField === "listingDate") setSortAsc(!sortAsc);
                    else {
                      setSortField("listingDate");
                      setSortAsc(false);
                    }
                  }}
                  className="cursor-pointer py-3 px-3 font-semibold hover:text-foreground"
                >
                  Listing Date
                </th>
                <th className="py-3 px-3 font-semibold text-right">Issue Size</th>
                <th className="py-3 px-3 font-semibold text-right">QIB (x)</th>
                <th className="py-3 px-3 font-semibold text-right">Retail (x)</th>
                <th className="py-3 px-3 font-semibold text-right">Expected GMP</th>
                <th
                  onClick={() => {
                    if (sortField === "listingGainPercent") setSortAsc(!sortAsc);
                    else {
                      setSortField("listingGainPercent");
                      setSortAsc(false);
                    }
                  }}
                  className="cursor-pointer py-3 pl-3 pr-4 font-semibold text-right hover:text-foreground"
                >
                  Listing Gain %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {displayIpos.length > 0 ? (
                displayIpos.map((ipo) => {
                  const isGain = ipo.listingGainPercent >= 0;
                  return (
                    <tr
                      key={ipo.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="font-medium text-foreground">
                          {ipo.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {ipo.symbol} · Issue: ₹{ipo.issuePrice}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={
                              ipo.board === "mainboard" ? "default" : "secondary"
                            }
                            className="text-[10px] px-1.5 py-0"
                          >
                            {ipo.board === "mainboard" ? "Main" : "SME"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                            {ipo.sector}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {ipo.listingDate}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        ₹{ipo.issueSizeCr.toLocaleString("en-IN")} Cr
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-emerald-400">
                        {ipo.subscription.qib}x
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                        {ipo.subscription.retail}x
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-medium text-foreground">
                          ₹{ipo.gmp}
                        </span>
                        <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                          ({ipo.gmpPercent}%)
                        </span>
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right">
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-bold ${
                            isGain
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {isGain ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {isGain ? "+" : ""}
                          {ipo.listingGainPercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    No historical IPOs matched your active filter criteria. Try relaxing the GMP % or subscription sliders.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
