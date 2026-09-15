"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Download, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApplyAccounts, type ApplyAccount } from "@/hooks/useApplyAccounts";
import { usePanLabels } from "@/hooks/usePanLabels";
import {
  BROKER_KEYS,
  getBrokerLabel,
  isValidPAN,
  maskPan,
  type BrokerKey,
} from "@/features/ipo-apply/lib/brokers";

const EMPTY_FORM = { label: "", pan: "", broker: "zerodha" as BrokerKey, dematId: "", upiId: "" };

export function AccountVault() {
  const { accounts, add, update, remove, clear } = useApplyAccounts();
  const { labels } = usePanLabels();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!form.label.trim()) return setError("Give this account a label (e.g. Self, Spouse).");
    if (!isValidPAN(form.pan)) return setError("Invalid PAN format (e.g. ABCDE1234F).");
    const res = editingId
      ? update(editingId, { ...form })
      : add({ ...form });
    if (!res.ok) return setError(res.error ?? "Could not save account.");
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(a: ApplyAccount) {
    setEditingId(a.id);
    setForm({
      label: a.label,
      pan: a.pan,
      broker: a.broker,
      dematId: a.dematId ?? "",
      upiId: a.upiId ?? "",
    });
    setError(null);
  }

  function importFromLabels() {
    const entries = Object.entries(labels);
    if (entries.length === 0) return setError("No PAN labels saved yet — add labels on the checker page first.");
    let added = 0;
    for (const [pan, label] of entries) {
      const res = add({ label, pan, broker: "other" });
      if (res.ok) added++;
    }
    setError(added === 0 ? "Those PANs are already in your vault." : null);
  }

  function exportVault() {
    const blob = new Blob([JSON.stringify(accounts, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ipodesk-apply-accounts.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Family accounts vault {accounts.length > 0 && <span className="text-muted-foreground">({accounts.length})</span>}
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Stored only in your browser. Never sent to our server.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={importFromLabels}>Import PAN labels</Button>
          {accounts.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={exportVault}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm("Wipe all saved accounts?")) clear(); }}>
                Wipe
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label htmlFor="vault-label">Label</Label>
          <Input id="vault-label" placeholder="Self / Spouse / Dad" value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="vault-pan">PAN</Label>
          <Input id="vault-pan" placeholder="ABCDE1234F" value={form.pan} className="uppercase"
            maxLength={10} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <Label htmlFor="vault-broker">Broker</Label>
          <select id="vault-broker" value={form.broker}
            onChange={(e) => setForm({ ...form, broker: e.target.value as BrokerKey })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {BROKER_KEYS.map((k) => (
              <option key={k} value={k}>{getBrokerLabel(k)}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="vault-upi">UPI ID <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="vault-upi" placeholder="name@bank" value={form.upiId}
            onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="vault-demat">Demat / BOID <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="vault-demat" placeholder="DP + Client ID" value={form.dematId}
            onChange={(e) => setForm({ ...form, dematId: e.target.value })} />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={submit}>
          {editingId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {editingId ? "Save changes" : "Add account"}
        </Button>
        {editingId && (
          <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setError(null); }}>
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
        )}
      </div>

      {/* List */}
      {accounts.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{a.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {maskPan(a.pan)} · {getBrokerLabel(a.broker)}
                  {a.upiId ? ` · ${a.upiId}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(a)} aria-label={`Edit ${a.label}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(a.id)} aria-label={`Remove ${a.label}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
