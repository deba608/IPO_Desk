"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
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
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback);
  else fallback();
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      title={`Copy ${label}`}
      onClick={() => copyText(text, () => { setOk(true); setTimeout(() => setOk(false), 1200); })}
      className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {ok ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {label}
    </button>
  );
}

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
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
        Tick at least one family account above to build the per-account checklist.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {accounts.map((a, i) => {
        const status: ApplyStatus = getApplyStatus(ipoId, a.id);
        const brokerUrl = getBrokerApplyUrl(a.broker);
        return (
          <li key={a.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  {a.label}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    {maskPan(a.pan)} · {lots} lot{lots > 1 ? "s" : ""} · {formatINR(amountPerAccount)}
                  </span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <CopyBtn text={a.pan} label="PAN" />
                  {a.upiId && <CopyBtn text={a.upiId} label="UPI" />}
                  {a.dematId && <CopyBtn text={a.dematId} label="Demat" />}
                </div>
              </div>
              <a
                href={brokerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Continue in {getBrokerLabel(a.broker)} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={`Status for ${a.label} — ${ipoName}`}>
              {APPLY_STATUSES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setApplyStatus(ipoId, a.id, key); tick((n) => n + 1); }}
                  aria-pressed={status === key}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                    status === key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

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
      onClick={() => copyText(tsv, () => { setOk(true); setTimeout(() => setOk(false), 1500); })}
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? "Copied!" : "Copy all details"}
    </Button>
  );
}
