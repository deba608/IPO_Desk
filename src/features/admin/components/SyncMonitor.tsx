"use client";

import { useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Server,
  Activity,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RegistrarHealth {
  name: string;
  code: string;
  status: "active" | "degraded" | "standby";
  lastSync: string;
  type: string;
}

const REGISTRARS_LIST: RegistrarHealth[] = [
  {
    name: "KFintech (KFin Technologies)",
    code: "kfintech",
    status: "active",
    lastSync: "2 mins ago",
    type: "Allotment & Discovery API",
  },
  {
    name: "Link Intime India",
    code: "linkintime",
    status: "active",
    lastSync: "5 mins ago",
    type: "Allotment & Discovery API",
  },
  {
    name: "Bigshare Services",
    code: "bigshare",
    status: "active",
    lastSync: "7 mins ago",
    type: "Session-Token Captcha Scraper",
  },
  {
    name: "MUFG Intime (formerly Link Intime)",
    code: "mufg",
    status: "active",
    lastSync: "3 mins ago",
    type: "Dynamic Form Scraper",
  },
  {
    name: "Skyline Financial Services",
    code: "skyline",
    status: "active",
    lastSync: "Just now",
    type: "Session-Token Form Scraper",
  },
  {
    name: "Purva Sharegistry",
    code: "purva",
    status: "active",
    lastSync: "Just now",
    type: "Django CSRF Form Scraper",
  },
  {
    name: "Maashitla Securities",
    code: "maashitla",
    status: "active",
    lastSync: "Just now",
    type: "JSON Allotment API",
  },
  {
    name: "InvestorGain / IPO Guru",
    code: "investorgain",
    status: "active",
    lastSync: "Just now",
    type: "Live GMP & Subscription Feed",
  },
];

export function SyncMonitor({ passcode }: { passcode: string }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    timestamp: string;
    durationMs: number;
    totalIpos?: number;
    success: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTriggerSync = async () => {
    setSyncing(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": passcode,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastSyncResult({
          timestamp: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
          durationMs: data.durationMs,
          totalIpos: data.calendar?.total,
          success: true,
        });
      } else {
        setErrorMsg(data.error || "Sync request failed");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Action Trigger Card ─────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Data Pipelines & Registrar Sync
              </h2>
              <Badge variant="success" className="gap-1 text-[11px]">
                <Activity className="h-3 w-3 animate-pulse" /> Live Ingestion
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Manually trigger background sync across all 7 Indian registrars and force reload the latest InvestorGain GMP cache.
            </p>
          </div>

          <button
            onClick={handleTriggerSync}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing All Sources..." : "Trigger Full Sync Now"}
          </button>
        </div>

        {/* Sync Result notification */}
        {lastSyncResult && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Sync completed successfully in <strong>{lastSyncResult.durationMs}ms</strong> at {lastSyncResult.timestamp} IST.
              </span>
            </div>
            {lastSyncResult.totalIpos !== undefined && (
              <span className="font-semibold">
                {lastSyncResult.totalIpos} Active IPOs Indexed
              </span>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Sync failed: {errorMsg}</span>
          </div>
        )}
      </div>

      {/* ── Registrar Adapters Status Grid ─────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REGISTRARS_LIST.map((reg) => (
          <div
            key={reg.code}
            className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-border/80"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground">
                    {reg.name}
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {reg.code}
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
              <span className="truncate max-w-[170px]">{reg.type}</span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Clock className="h-3 w-3" /> {reg.lastSync}
              </span>
            </div>
          </div>
        ))}

        {/* Database Persistence Status Card */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">
                  Prisma Postgres Store
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Schema v1.2
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
              Ready
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
            <span>GMP & Sub Snapshots</span>
            <span className="font-mono text-[10px] text-foreground">
              Auto-persisting
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
