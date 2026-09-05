"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  Trophy,
  SearchX,
  Layers,
  Tag,
  Share2,
  Loader2,
  ArrowUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScanIPOResult, ScanResponse } from "@/types/allotment.types";
import { usePanLabels } from "@/hooks/usePanLabels";
import { shareResultCard } from "../lib/shareCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech: "KFintech",
  mufg: "MUFG Intime",
  linkintime: "Link Intime",
  bigshare: "Bigshare",
  skyline: "Skyline",
  purva: "Purva Sharegistry",
  maashitla: "Maashitla",
};

export function ScanResultsDashboard({ results, onCheckAgain }: { results: ScanResponse; onCheckAgain?: () => void }) {
  const { iposWithAllotment, totalAllotted, scanned, ipos, errors, pansChecked } =
    results;
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const outcome = await shareResultCard(
        {
          title: "Cross-IPO Scan",
          subtitle: `${pansChecked} PAN${pansChecked === 1 ? "" : "s"} · ${scanned} IPOs`,
          headline:
            iposWithAllotment > 0
              ? `Allotted in ${iposWithAllotment} IPO${iposWithAllotment === 1 ? "" : "s"}`
              : "No allotment yet",
          positive: iposWithAllotment > 0,
          stats: [
            { label: "IPOs Scanned", value: String(scanned) },
            { label: "Applied To", value: String(ipos.length) },
            { label: "Allotments", value: String(iposWithAllotment) },
            { label: "Shares", value: String(totalAllotted) },
          ],
        },
        "ipo-scan-result.png"
      );
      toast.success(outcome === "shared" ? "Shared!" : "Image downloaded");
    } catch {
      toast.error("Couldn't generate share image");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">Scan Results</h2>
          <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
            {pansChecked} PAN{pansChecked === 1 ? "" : "s"} across {scanned} active
            IPO{scanned === 1 ? "" : "s"} · Checked{" "}
            {new Date(results.checkedAt).toLocaleString("en-IN")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          disabled={isSharing}
          className="shrink-0 gap-2"
        >
          {isSharing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          Share
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          label="IPOs Scanned"
          value={scanned}
          icon={<Layers className="h-4 w-4" />}
          color="text-foreground"
        />
        <SummaryCard
          label="Applied To"
          value={ipos.length}
          icon={<SearchX className="h-4 w-4" />}
          color="text-blue-400"
          bgClass="bg-blue-500/10 border-blue-500/20"
        />
        <SummaryCard
          label="Allotments"
          value={iposWithAllotment}
          icon={<Trophy className="h-4 w-4" />}
          color="text-emerald-400"
          bgClass="bg-emerald-500/10 border-emerald-500/20"
        />
        <SummaryCard
          label="Shares Allotted"
          value={totalAllotted}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="text-emerald-400"
          bgClass="bg-emerald-500/10 border-emerald-500/20"
        />
      </div>

      {errors > 0 && (
        <p className="flex items-center gap-2 text-xs text-amber-400">
          <AlertCircle className="h-3.5 w-3.5" />
          {errors} check{errors === 1 ? "" : "s"} failed and were skipped — some
          registrars may be temporarily unavailable.
        </p>
      )}

      {/* Per-IPO cards */}
      {ipos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-center">
          <SearchX className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No applications found</p>
          <p className="text-sm text-muted-foreground">
            None of these PANs applied to any of the {scanned} active IPOs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ipos.map((ipo) => (
            <IPOScanCard key={ipo.ipoId} ipo={ipo} />
          ))}
        </div>
      )}

      {/* Check Again CTA */}
      {onCheckAgain && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCheckAgain}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Check Again
          </Button>
        </div>
      )}
    </div>
  );
}

function IPOScanCard({ ipo }: { ipo: ScanIPOResult }) {
  const hasAllotment = ipo.summary.allotted > 0;
  const [open, setOpen] = useState(hasAllotment);
  const { getLabel } = usePanLabels();

  // Allotted rows first, then not_allotted; drop not_found noise.
  const rows = ipo.results
    .filter((r) => r.status === "allotted" || r.status === "not_allotted")
    .sort((a, b) => (a.status === "allotted" ? -1 : 1) - (b.status === "allotted" ? -1 : 1));

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-colors",
        hasAllotment ? "border-emerald-500/30" : "border-border"
      )}
    >
      {/* A <Link> inside a <button> is invalid HTML (hydration mismatch) —
          use a clickable div with keyboard support instead. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          {hasAllotment ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <Trophy className="h-4 w-4 text-emerald-400" />
            </span>
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0">
            <Link
              href={`/ipo/${ipo.ipoId}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate font-medium hover:text-primary hover:underline"
            >
              {ipo.ipoName}
            </Link>
            <p className="text-[11px] text-muted-foreground">
              {REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasAllotment ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {ipo.summary.allotted} allotted
            </Badge>
          ) : (
            <Badge variant="secondary">{ipo.summary.notAllotted} applied</Badge>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <div className="space-y-1.5">
            {rows.map((r) => {
              const label = getLabel(r.pan);
              const allotted = r.status === "allotted";
              return (
                <div
                  key={r.pan}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {allotted ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                    )}
                    <code className="font-mono text-xs font-medium text-primary">
                      {r.pan}
                    </code>
                    {label && (
                      <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        <Tag className="h-2.5 w-2.5" />
                        {label}
                      </span>
                    )}
                    {r.name && (
                      <span className="truncate text-xs text-muted-foreground">
                        {r.name}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-xs tabular-nums",
                      allotted ? "font-semibold text-emerald-400" : "text-muted-foreground"
                    )}
                  >
                    {allotted
                      ? `${(r.allottedShares ?? 0).toLocaleString("en-IN")} shares`
                      : "Not allotted"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  bgClass?: string;
}

function SummaryCard({
  label,
  value,
  icon,
  color = "text-foreground",
  bgClass = "bg-card border-border",
}: SummaryCardProps) {
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${bgClass}`}>
      <div className={`mb-2 flex items-center gap-2 text-xs ${color} opacity-70`}>
        {icon}
        {label}
      </div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>
        {value.toLocaleString("en-IN")}
      </div>
    </div>
  );
}
