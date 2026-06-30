"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  History as HistoryIcon,
  Trash2,
  Target,
  ScanSearch,
  CheckCircle2,
  TrendingUp,
  Hash,
  X,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCheckHistory } from "@/hooks/useCheckHistory";
import { toast } from "sonner";

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech: "KFintech",
  mufg: "MUFG Intime",
  linkintime: "Link Intime",
  bigshare: "Bigshare",
};

export default function HistoryPage() {
  const { entries, remove, clear, hydrated } = useCheckHistory();

  const stats = useMemo(() => {
    const checks = entries.filter((e) => e.type === "check");
    const scans = entries.filter((e) => e.type === "scan");
    // PAN-level allotments only count for single checks (scan "allotted" is IPO-level).
    const pansChecked = checks.reduce((s, e) => s + e.total, 0);
    const pansAllotted = checks.reduce((s, e) => s + e.allotted, 0);
    return {
      total: entries.length,
      checks: checks.length,
      scans: scans.length,
      pansChecked,
      pansAllotted,
      rate: pansChecked > 0 ? Math.round((pansAllotted / pansChecked) * 100) : 0,
    };
  }, [entries]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <HistoryIcon className="h-6 w-6 text-primary" />
              Check History
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your recent allotment checks and scans, stored on this device.
            </p>
          </div>
          {hydrated && entries.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-rose-400 hover:text-rose-300"
              onClick={() => {
                clear();
                toast.success("History cleared");
              }}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {!hydrated ? null : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
            <HistoryIcon className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No checks yet</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Allotment checks you run will show up here.
            </p>
            <Button asChild size="sm">
              <Link href="/">Check an IPO</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Total Checks"
                value={stats.total}
                icon={<Hash className="h-4 w-4" />}
              />
              <StatCard
                label="PANs Checked"
                value={stats.pansChecked}
                icon={<Target className="h-4 w-4" />}
              />
              <StatCard
                label="PANs Allotted"
                value={stats.pansAllotted}
                icon={<CheckCircle2 className="h-4 w-4" />}
                color="text-emerald-400"
                bgClass="bg-emerald-500/10 border-emerald-500/20"
              />
              <StatCard
                label="Win Rate"
                value={`${stats.rate}%`}
                icon={<TrendingUp className="h-4 w-4" />}
                color="text-primary"
              />
            </div>

            {/* Entries */}
            <div className="space-y-2">
              {entries.map((e) => {
                const isScan = e.type === "scan";
                const won = e.allotted > 0;
                return (
                  <div
                    key={e.id}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          won ? "bg-emerald-500/15" : "bg-muted"
                        }`}
                      >
                        {isScan ? (
                          <ScanSearch
                            className={`h-4 w-4 ${won ? "text-emerald-400" : "text-muted-foreground"}`}
                          />
                        ) : (
                          <Target
                            className={`h-4 w-4 ${won ? "text-emerald-400" : "text-muted-foreground"}`}
                          />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {isScan ? `Scan · ${e.label}` : e.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatTime(e.at)} · {e.pansChecked} PAN
                          {e.pansChecked === 1 ? "" : "s"}
                          {!isScan && e.registrar
                            ? ` · ${REGISTRAR_LABELS[e.registrar] ?? e.registrar}`
                            : ""}
                          {isScan && e.appliedTo !== undefined
                            ? ` · applied to ${e.appliedTo}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {won ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {isScan
                            ? `${e.allotted} IPO${e.allotted === 1 ? "" : "s"}`
                            : `${e.allotted}/${e.total}`}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No allotment</Badge>
                      )}
                      <button
                        type="button"
                        aria-label="Remove entry"
                        onClick={() => remove(e.id)}
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
  bgClass?: string;
}

function StatCard({
  label,
  value,
  icon,
  color = "text-foreground",
  bgClass = "bg-card border-border",
}: StatCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${bgClass}`}>
      <div className={`mb-2 flex items-center gap-2 text-xs ${color} opacity-70`}>
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums sm:text-3xl ${color}`}>
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </div>
    </div>
  );
}
