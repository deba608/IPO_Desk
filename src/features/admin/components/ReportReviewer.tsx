"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Sparkles,
  Award,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CalendarIPOWithStatus } from "@/types/calendar.types";
import { ResearchReport } from "@/services/report.service";

export function ReportReviewer() {
  const [ipos, setIpos] = useState<CalendarIPOWithStatus[]>([]);
  const [selectedIpoId, setSelectedIpoId] = useState<string | null>(null);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    fetch("/api/calendar")
      .then((res) => res.json())
      .then((data) => {
        const list: CalendarIPOWithStatus[] = data.ipos || [];
        setIpos(list);
        if (list.length > 0) {
          setSelectedIpoId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedIpoId) return;
    setLoadingReport(true);
    fetch(`/api/ipo/${selectedIpoId}/report`)
      .then((res) => res.json())
      .then((data) => setReport(data))
      .catch(() => setReport(null))
      .finally(() => setLoadingReport(false));
  }, [selectedIpoId]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              AI & Quantitative Research Engine Inspector
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Select Issue:</span>
            <select
              value={selectedIpoId || ""}
              onChange={(e) => setSelectedIpoId(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              {ipos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.board.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Report Preview Card ───────────────────────────────── */}
      {loadingReport ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-xs text-muted-foreground">
          <RefreshCw className="mx-auto mb-2 h-4 w-4 animate-spin text-primary" />
          Computing research assessment...
        </div>
      ) : report ? (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Left Summary (4 cols) */}
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Overall Quantitative Score
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className={`text-4xl font-black ${
                      report.overallScore >= 75
                        ? "text-emerald-400"
                        : report.overallScore >= 50
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {report.overallScore}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    / 100
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Algorithmic Verdict
                </p>
                <div className="mt-1">
                  <Badge
                    variant={
                      report.verdict === "strong_apply" || report.verdict === "apply"
                        ? "success"
                        : report.verdict === "apply_listing"
                        ? "info"
                        : report.verdict === "neutral"
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-xs px-2.5 py-1"
                  >
                    {report.verdictLabel}
                  </Badge>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                <p>
                  Evaluated on financial scale, valuation bandwidth, QIB & retail demand, and grey market momentum.
                </p>
              </div>
            </div>
          </div>

          {/* Right Sections (8 cols) */}
          <div className="space-y-3 lg:col-span-8">
            {report.sections.map((sec, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2">
                  <h3 className="text-xs font-semibold text-foreground">
                    {sec.title}
                  </h3>
                  {sec.score !== undefined && (
                    <span className="font-mono text-xs font-semibold text-primary">
                      {sec.score} / {sec.maxScore ?? 100}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {sec.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-xs text-muted-foreground">
          No report available for this IPO.
        </div>
      )}
    </div>
  );
}
