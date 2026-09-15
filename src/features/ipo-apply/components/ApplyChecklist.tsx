"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  ExternalLink,
  ListChecks,
  SkipForward,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApplyAccount } from "@/hooks/useApplyAccounts";
import {
  formatINR,
  getBrokerApplyUrl,
  getBrokerLabel,
  maskPan,
} from "@/features/ipo-apply/lib/brokers";
import {
  APPLY_STATUSES,
  getApplyStatus,
  setApplyStatus,
  subscribeApplyStatus,
  type ApplyStatus,
} from "@/features/ipo-apply/lib/apply-store";

// ─── copy helper ────────────────────────────────────────────────────────────

function copyText(text: string, done: () => void) {
  const fallback = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      done();
    } catch {
      // clipboard unavailable
    }
  };
  if (navigator.clipboard?.writeText)
    navigator.clipboard.writeText(text).then(done).catch(fallback);
  else fallback();
}

// ─── copy badge ──────────────────────────────────────────────────────────────

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      title={`Copy ${label}`}
      onClick={() =>
        copyText(text, () => {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        })
      }
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-all duration-150 ${
        ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
      }`}
    >
      {ok ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
      {ok ? "Copied!" : label}
    </button>
  );
}

// ─── status config ───────────────────────────────────────────────────────────

type StatusCfg = {
  icon: React.ReactNode;
  label: string;
  chipInactive: string;
  chipActive: string;
  cardBorder: string;
};

const STATUS_CONFIG: Record<ApplyStatus, StatusCfg> = {
  "not-started": {
    icon: <Circle className="h-3 w-3" />,
    label: "Not started",
    chipInactive:
      "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
    chipActive: "border-primary/40 bg-primary/10 text-primary",
    cardBorder: "border-border",
  },
  applied: {
    icon: <Clock className="h-3 w-3" />,
    label: "Applied",
    chipInactive:
      "border-border text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-300",
    chipActive: "border-amber-500/50 bg-amber-500/10 text-amber-300",
    cardBorder: "border-amber-500/25",
  },
  "upi-pending": {
    icon: <Wifi className="h-3 w-3" />,
    label: "UPI pending",
    chipInactive:
      "border-border text-muted-foreground hover:border-orange-500/40 hover:bg-orange-500/5 hover:text-orange-300",
    chipActive: "border-orange-500/50 bg-orange-500/10 text-orange-300",
    cardBorder: "border-orange-500/25",
  },
  "upi-approved": {
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "UPI approved",
    chipInactive:
      "border-border text-muted-foreground hover:border-sky-500/40 hover:bg-sky-500/5 hover:text-sky-300",
    chipActive: "border-sky-500/50 bg-sky-500/10 text-sky-300",
    cardBorder: "border-sky-500/25",
  },
  done: {
    icon: <Check className="h-3 w-3" />,
    label: "Done ✓",
    chipInactive:
      "border-border text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-300",
    chipActive: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
    cardBorder: "border-emerald-500/25",
  },
  skipped: {
    icon: <SkipForward className="h-3 w-3" />,
    label: "Skipped",
    chipInactive:
      "border-border text-muted-foreground hover:border-zinc-500/30 hover:bg-zinc-500/5 hover:text-zinc-400",
    chipActive: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
    cardBorder: "border-zinc-500/20",
  },
};

// ─── main checklist ──────────────────────────────────────────────────────────

export function ApplyChecklist({
  ipoId,
  ipoName,
  accounts,
  lots,
  amountPerAccount,
}: {
  ipoId: string;
  ipoName: string;
  accounts: ApplyAccount[];
  lots: number;
  amountPerAccount: number;
}) {
  const [, tick] = useState(0);

  useEffect(() => subscribeApplyStatus(() => tick((n) => n + 1)), []);

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/10 px-6 py-10 text-center">
        <ListChecks className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">No accounts selected</p>
        <p className="max-w-xs text-xs text-muted-foreground/60">
          Tick at least one family account above to build the per-account application checklist.
        </p>
      </div>
    );
  }

  const confirmedCount = accounts.filter((a) => {
    const s = getApplyStatus(ipoId, a.id);
    return s === "done" || s === "upi-approved";
  }).length;

  return (
    <div className="space-y-3">
      {/* progress bar (only when multiple accounts) */}
      {accounts.length > 1 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>Overall progress</span>
              <span>{confirmedCount}/{accounts.length} confirmed</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(confirmedCount / accounts.length) * 100}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 text-sm font-bold text-foreground">
            {Math.round((confirmedCount / accounts.length) * 100)}%
          </span>
        </div>
      )}

      {/* per-account cards */}
      <ol className="space-y-2">
        {accounts.map((a, i) => {
          const status: ApplyStatus = getApplyStatus(ipoId, a.id);
          const brokerUrl = getBrokerApplyUrl(a.broker);
          const cfg = STATUS_CONFIG[status];
          const isDone = status === "done";
          const isSkipped = status === "skipped";
          const isDimmed = isDone || isSkipped;

          return (
            <li
              key={a.id}
              className={`rounded-xl border bg-card transition-all duration-300 ${cfg.cardBorder} ${isDimmed ? "opacity-60" : ""}`}
            >
              {/* card top */}
              <div className="flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap">
                {/* step badge */}
                <span
                  className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    isDone
                      ? "bg-emerald-500/20 text-emerald-400"
                      : isSkipped
                      ? "bg-zinc-500/20 text-zinc-500"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {isDone ? <Check className="h-3 w-3" /> : i + 1}
                </span>

                {/* info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p
                      className={`text-sm font-semibold transition-colors ${
                        isDimmed ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {a.label}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {maskPan(a.pan)} · {getBrokerLabel(a.broker)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {lots} lot{lots > 1 ? "s" : ""} ·{" "}
                    <span className="font-medium text-foreground">{formatINR(amountPerAccount)}</span>{" "}
                    blocked via UPI
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <CopyBtn text={a.pan} label="PAN" />
                    {a.upiId && <CopyBtn text={a.upiId} label="UPI ID" />}
                    {a.dematId && <CopyBtn text={a.dematId} label="Demat" />}
                  </div>
                </div>

                {/* broker link */}
                <a
                  href={brokerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-[11px] font-semibold text-primary transition-all hover:border-primary/60 hover:bg-primary/20"
                >
                  Apply <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* status strip */}
              <div className="border-t border-border/50 px-3 py-2">
                <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Mark status
                </p>
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label={`Status for ${a.label} — ${ipoName}`}
                >
                  {APPLY_STATUSES.map(({ key }) => {
                    const c = STATUS_CONFIG[key];
                    const isActive = status === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setApplyStatus(ipoId, a.id, key);
                          tick((n) => n + 1);
                        }}
                        aria-pressed={isActive}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all duration-150 ${
                          isActive ? c.chipActive : c.chipInactive
                        }`}
                      >
                        {isActive && c.icon}
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── bulk helpers ────────────────────────────────────────────────────────────

// Bulk helpers shared by the workspace (pure string building — testable, no DOM).
export function buildCopyAllTsv(args: {
  ipoName: string;
  lots: number;
  amountPerAccount: number;
  accounts: ApplyAccount[];
}): string {
  const { ipoName, lots, amountPerAccount, accounts } = args;
  const head = `IPO\tLabel\tPAN\tBroker\tUPI\tDemat\tLots\tAmount`;
  const rows = accounts.map((a) =>
    [ipoName, a.label, a.pan, getBrokerLabel(a.broker), a.upiId ?? "", a.dematId ?? "", String(lots), String(amountPerAccount)].join("\t")
  );
  return [head, ...rows].join("\n");
}

// Re-exported for the workspace's "Copy all" button (keeps clipboard code in one place).
export function CopyAllButton({ tsv }: { tsv: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!tsv}
      onClick={() =>
        copyText(tsv, () => {
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        })
      }
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? "Copied!" : "Copy all details"}
    </Button>
  );
}
