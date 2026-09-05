"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Lock,
  Activity,
  Terminal,
  KeyRound,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SyncMonitor } from "./SyncMonitor";
import { LogViewer } from "./LogViewer";

// Kept deliberately to two tabs: triggering syncs + reading logs are the
// only admin operations. The IPO catalogue is the public calendar page;
// research reports are inspected on the IPO detail pages.
type AdminTab = "sync" | "logs";

export function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("sync");

  // Step 1: request a login code. The server answers generically so this
  // reveals nothing about who is allowlisted — always advance to the code
  // step unless the request itself was malformed or throttled.
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = identifier.trim();
    if (!id) {
      setErrorMsg("Enter your admin email");
      return;
    }
    setBusy(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: id }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setErrorMsg(data?.error ?? "Request failed. Try again.");
        return;
      }
      setStep("code");
      setCode("");
    } catch {
      setErrorMsg("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2: verify the 6-digit code → server sets the admin session cookie.
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setErrorMsg("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error ?? "Verification failed.");
        return;
      }
      setIsAuthenticated(true);
    } catch {
      setErrorMsg("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleLock = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Cookie clear is best-effort; still drop local state.
    }
    setIsAuthenticated(false);
    setStep("identifier");
    setIdentifier("");
    setCode("");
    setErrorMsg("");
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold text-foreground">
              IPODesk Control Console
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter administrator passcode to manage registrar data syncs, monitor server logs, and inspect pipelines.
            </p>
          </div>

          {step === "identifier" ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Admin email
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60"
                    autoFocus
                  />
                </div>
                {errorMsg && (
                  <p className="mt-1.5 text-xs text-rose-400">{errorMsg}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Sending…" : (
                  <>Send login code <ArrowRight className="h-3.5 w-3.5" /></>
                )}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                Passwordless — a 6-digit code arrives by email.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  6-digit code sent to {identifier.trim()}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                  disabled={busy}
                  className="w-full rounded-xl border border-border bg-background py-2 px-3 text-center text-lg font-mono tracking-[0.3em] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60"
                  autoFocus
                />
                {errorMsg && (
                  <p className="mt-1.5 text-xs text-rose-400">{errorMsg}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Verifying…" : (
                  <>Access Dashboard <ArrowRight className="h-3.5 w-3.5" /></>
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep("identifier");
                  setCode("");
                  setErrorMsg("");
                }}
                className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ─────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              <ShieldAlert className="mr-1 h-3 w-3" /> System Operations
            </Badge>
            <Badge variant="success" className="text-xs">
              Authenticated Session
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Admin & Data Control Center</h1>
          <p className="text-xs text-muted-foreground">
            Manage live scraper queues, inspect system logs, verify registrar feeds, and review algorithmic reports.
          </p>
        </div>

        <button
          onClick={handleLock}
          className="self-start rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:self-auto"
        >
          Lock Console
        </button>
      </div>

      {/* ── Navigation Tabs ───────────────────────────────────── */}
      <div className="no-scrollbar flex overflow-x-auto border-b border-border/60">
        {[
          { id: "sync" as AdminTab, label: "Pipelines & Sync", icon: Activity },
          { id: "logs" as AdminTab, label: "Live Log Stream", icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ───────────────────────────────────────── */}
      <div>
        {activeTab === "sync" && <SyncMonitor />}
        {activeTab === "logs" && <LogViewer />}
      </div>
    </div>
  );
}
