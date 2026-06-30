"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, AlertTriangle, TrendingUp, BarChart3, Shield } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { ResearchReport as ResearchReportType } from "@/services/report.service";

const VERDICT_COLORS: Record<string, { badge: "success" | "default" | "warning" | "secondary" | "destructive"; bg: string; text: string }> = {
  strong_apply: { badge: "success", bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400" },
  apply: { badge: "success", bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400" },
  apply_listing: { badge: "warning", bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400" },
  neutral: { badge: "secondary", bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-400" },
  avoid: { badge: "destructive", bg: "bg-rose-500/10 border-rose-500/30", text: "text-rose-400" },
};

function SectionIcon({ title }: { title: string }) {
  if (title.toLowerCase().includes("overview")) return <BarChart3 className="h-4 w-4 text-primary" />;
  if (title.toLowerCase().includes("financial") || title.toLowerCase().includes("health")) return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (title.toLowerCase().includes("risk")) return <Shield className="h-4 w-4 text-amber-400" />;
  if (title.toLowerCase().includes("sentiment")) return <Sparkles className="h-4 w-4 text-violet-400" />;
  return <BarChart3 className="h-4 w-4 text-primary" />;
}

interface ResearchReportProps {
  ipoId: string;
}

export function ResearchReport({ ipoId }: ResearchReportProps) {
  const [report, setReport] = useState<ResearchReportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]));

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ipo/${encodeURIComponent(ipoId)}/report`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setReport(json); })
      .catch(() => { if (!cancelled) setReport(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ipoId]);

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!report) return null;

  const colors = VERDICT_COLORS[report.verdict] ?? VERDICT_COLORS.neutral;

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      <div className={`rounded-xl border ${colors.bg} p-4`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">AI Research Verdict</p>
            <p className={`mt-1 text-lg font-bold ${colors.text}`}>{report.verdictLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Overall Score</p>
            <p className={`text-2xl font-bold ${colors.text}`}>{report.overallScore}</p>
            <p className="text-[10px] text-muted-foreground">/ 100</p>
          </div>
        </div>
        {report.overallScore !== undefined && (
          <Progress value={report.overallScore} className="mt-3 h-1.5" />
        )}

        {/* Radar chart */}
        {(() => {
          const scoredSections = report.sections.filter((s) => s.score !== undefined);
          if (scoredSections.length < 2) return null;
          const radarData = scoredSections.map((s) => ({
            category: s.title.length > 14 ? s.title.slice(0, 13) + "…" : s.title,
            score: s.score!,
            fullMark: s.maxScore!,
          }));
          return (
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis
                    dataKey="category"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fontSize: 9, fill: "#64748b" }}
                  />
                  <Radar
                    dataKey="score"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </div>

      <Separator />

      {/* Sections */}
      {report.sections.map((section, idx) => (
        <div key={idx} className="rounded-lg border border-border">
          <button
            onClick={() => toggleSection(idx)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
          >
            <div className="flex items-center gap-2.5">
              <SectionIcon title={section.title} />
              <span className="text-sm font-medium text-foreground">{section.title}</span>
              {section.score !== undefined && (
                <Badge variant="outline" className="text-[10px]">
                  {section.score}/{section.maxScore}
                </Badge>
              )}
            </div>
            {expandedSections.has(idx) ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
          {expandedSections.has(idx) && (
            <div className="border-t border-border px-4 py-3">
              <p className="text-sm leading-relaxed text-muted-foreground">{section.content}</p>
              {section.score !== undefined && section.maxScore && (
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={(section.score / section.maxScore) * 100} className="h-1" />
                  <span className="text-[10px] text-muted-foreground">
                    {section.score}/{section.maxScore}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        <p className="text-[10px] leading-relaxed text-muted-foreground">{report.disclaimer}</p>
      </div>
    </div>
  );
}
