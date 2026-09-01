"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  Terminal,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  event: string;
  message: string;
  durationMs?: number;
  meta?: Record<string, string | number | boolean>;
}

export function LogViewer({ passcode }: { passcode: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "info" | "warn" | "error">("all");

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/logs?limit=300", {
        headers: {
          Authorization: `Bearer ${passcode}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [passcode]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== "all" && log.level !== levelFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.event.toLowerCase().includes(q) ||
        log.level.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* ── Control Bar ──────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            System Event Stream ({filteredLogs.length} entries)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Level Filter Tabs */}
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
            {(["all", "info", "warn", "error"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                  levelFilter === lvl
                    ? "bg-card font-semibold text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors ${
              autoRefresh
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <RefreshCw
              className={`h-3 w-3 ${autoRefresh ? "animate-spin" : ""}`}
            />
            {autoRefresh ? "Live 5s" : "Paused"}
          </button>

          <button
            onClick={fetchLogs}
            className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Log Feed Terminal Container ───────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-black/80 font-mono shadow-inner">
        <div className="flex items-center justify-between border-b border-border/40 bg-zinc-900/60 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2">stdout / serverless-ringbuffer</span>
          </div>
          <span>Showing latest {filteredLogs.length} events</span>
        </div>

        <div className="max-h-[500px] overflow-y-auto divide-y divide-zinc-800/40 p-2 text-xs">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((entry, index) => {
              const isErr = entry.level === "error";
              const isWarn = entry.level === "warn";
              const time = new Date(entry.timestamp).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <div
                  key={index}
                  className="flex flex-col gap-1 px-3 py-2 text-[11px] transition-colors hover:bg-zinc-900/40 sm:flex-row sm:items-start sm:gap-3"
                >
                  <span className="shrink-0 text-zinc-500">{time}</span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase font-bold ${
                      isErr
                        ? "bg-rose-500/20 text-rose-400"
                        : isWarn
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {isErr ? (
                      <AlertCircle className="h-2.5 w-2.5" />
                    ) : isWarn ? (
                      <AlertTriangle className="h-2.5 w-2.5" />
                    ) : (
                      <CheckCircle className="h-2.5 w-2.5" />
                    )}
                    {entry.level}
                  </span>

                  <span className="shrink-0 text-primary/80 font-semibold">
                    [{entry.event}]
                  </span>

                  <span className="flex-1 text-zinc-200 break-words">
                    {entry.message}
                    {entry.durationMs !== undefined && (
                      <span className="ml-1.5 text-zinc-400">
                        ({entry.durationMs}ms)
                      </span>
                    )}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-zinc-500">
              {loading ? "Loading server log stream..." : "No events match the selected criteria."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
