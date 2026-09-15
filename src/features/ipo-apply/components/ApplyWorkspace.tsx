"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useApplyAccounts } from "@/hooks/useApplyAccounts";
import {
  formatINR,
  getBrokerApplyUrl,
  getBrokerLabel,
  maskPan,
} from "@/features/ipo-apply/lib/brokers";
import { getApplyStatus, subscribeApplyStatus } from "@/features/ipo-apply/lib/apply-store";
import { AccountVault } from "./AccountVault";
import { ApplyChecklist, CopyAllButton, buildCopyAllTsv } from "./ApplyChecklist";
import type { CalendarIPOWithStatus, CalendarResponse } from "@/types/calendar.types";

export function ApplyWorkspace() {
  const searchParams = useSearchParams();
  const { accounts } = useApplyAccounts();
  const [ipos, setIpos] = useState<CalendarIPOWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [lots, setLots] = useState(1);
  const [ticked, setTicked] = useState<string[]>([]);
  const [, bumpStatus] = useState(0);

  // Load calendar IPOs (open + upcoming first).
  useEffect(() => {
    let live = true;
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((d: CalendarResponse) => {
        if (!live) return;
        const sorted = [...(d.ipos ?? [])].sort((a, b) => {
          const rank = (l: string) => (l === "open" ? 0 : l === "upcoming" ? 1 : l === "closed" ? 2 : 3);
          return rank(a.lifecycle) - rank(b.lifecycle) || a.closeDate.localeCompare(b.closeDate);
        });
        setIpos(sorted);
        setLoading(false);
      })
      .catch(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  // ?ipo=<id-or-name> deep-link (from IPO detail page). Resolved during
  // render (no setState-in-effect): explicit user choice wins, else the URL
  // param, else the first open IPO.
  const paramIpo = searchParams.get("ipo");
  const resolvedId = useMemo(() => {
    if (selectedId) return selectedId;
    if (ipos.length === 0) return "";
    if (paramIpo) {
      const match =
        ipos.find((i) => i.id === paramIpo) ??
        ipos.find((i) => i.name.toLowerCase() === paramIpo.toLowerCase());
      if (match) return match.id;
    }
    return ipos.find((i) => i.lifecycle === "open")?.id ?? "";
  }, [selectedId, ipos, paramIpo]);

  useEffect(() => subscribeApplyStatus(() => bumpStatus((n) => n + 1)), []);

  // Default-tick all accounts once vault loads.
  useEffect(() => {
    if (accounts.length > 0 && ticked.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTicked(accounts.map((a) => a.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  const ipo = useMemo(() => ipos.find((i) => i.id === resolvedId), [ipos, resolvedId]);
  const selected = useMemo(
    () => accounts.filter((a) => ticked.includes(a.id)),
    [accounts, ticked]
  );
  const price = ipo?.priceBand.max ?? 0;
  const perAccount = (ipo?.lotSize ?? 0) * price * lots;
  const total = perAccount * selected.length;

  const approved = ipo ? selected.filter((a) => {
    const s = getApplyStatus(ipo.id, a.id);
    return s === "upi-approved" || s === "done";
  }).length : 0;

  const tsv = useMemo(
    () => (ipo && selected.length > 0
      ? buildCopyAllTsv({ ipoName: ipo.name, lots, amountPerAccount: perAccount, accounts: selected })
      : ""),
    [ipo, selected, lots, perAccount]
  );

  function toggle(id: string) {
    setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  function openAllBrokers() {
    const urls = [...new Set(selected.map((a) => getBrokerApplyUrl(a.broker)))];
    for (const u of urls) window.open(u, "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      <AccountVault />

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">1 · Pick IPO & lots</h2>
        {loading ? (
          <p className="mt-2 text-xs text-muted-foreground">Loading open IPOs…</p>
        ) : ipos.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No IPOs found right now. Try again later.</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="apply-ipo" className="mb-1 block text-[11px] text-muted-foreground">IPO</label>
              <select
                id="apply-ipo"
                value={resolvedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select an IPO…</option>
                {ipos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} — {i.lifecycle.toUpperCase()} · closes {i.closeDate}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-[11px] text-muted-foreground">Lots per account</span>
              <div className="flex h-10 items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setLots((l) => Math.max(1, l - 1))} aria-label="Fewer lots">
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-10 text-center text-sm font-semibold" aria-live="polite">{lots}</span>
                <Button variant="outline" size="sm" onClick={() => setLots((l) => Math.min(20, l + 1))} aria-label="More lots">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                {ipo && (
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    {ipo.lotSize.toLocaleString("en-IN")} shares/lot · {formatINR(price)}/share
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {ipo && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            UPI mandate for <strong>{ipo.name}</strong> must be approved before <strong>5 PM on {ipo.closeDate}</strong>,
            else the application lapses. {formatINR(perAccount)} blocked per account.
          </div>
        )}
      </div>

      {accounts.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">2 · Tick who applies (1 PAN = 1 bid)</h2>
            <div className="flex gap-2 text-[11px]">
              <button type="button" className="text-primary hover:underline" onClick={() => setTicked(accounts.map((a) => a.id))}>Select all</button>
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => setTicked([])}>Clear</button>
            </div>
          </div>
          <ul className="space-y-1">
            {accounts.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={ticked.includes(a.id)}
                    onChange={() => toggle(a.id)}
                    className="h-4 w-4 accent-current"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground">{a.label}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {maskPan(a.pan)} · {getBrokerLabel(a.broker)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {ipo && selected.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
              <p className="font-semibold text-foreground">
                {selected.length} account{selected.length > 1 ? "s" : ""} × {formatINR(perAccount)} = {formatINR(total)} blocked
              </p>
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>UPI approved: {approved}/{selected.length}</span>
                  <span>{selected.length ? Math.round((approved / selected.length) * 100) : 0}%</span>
                </div>
                <Progress value={selected.length ? (approved / selected.length) * 100 : 0} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyAllButton tsv={tsv} />
                <Button size="sm" variant="outline" onClick={openAllBrokers}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open broker IPO pages ({new Set(selected.map((a) => a.broker)).size})
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Login + bid + UPI approval happen there, per account.
              </p>
            </div>
          )}
        </div>
      )}

      {ipo && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">3 · Apply in broker app, then tick here</h2>
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
              Stored locally · never sent to server
            </span>
          </div>
          <ApplyChecklist
            ipoId={ipo.id}
            ipoName={ipo.name}
            accounts={selected}
            lots={lots}
            amountPerAccount={perAccount}
          />
        </div>
      )}

      <p className="pb-2 text-center text-[10px] text-muted-foreground">
        IPO Desk never places bids or moves money. Bids are placed only in your broker&apos;s app under your login.
      </p>
    </div>
  );
}
