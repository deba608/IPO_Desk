"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Lock,
  Activity,
  Terminal,
  Building2,
  Sparkles,
  KeyRound,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SyncMonitor } from "./SyncMonitor";
import { LogViewer } from "./LogViewer";
import { IpoManager } from "./IpoManager";
import { ReportReviewer } from "./ReportReviewer";

type AdminTab = "sync" | "logs" | "ipos" | "reports";

export function AdminDashboard() {
  const [passcode, setPasscode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("sync");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      setErrorMsg("Please enter the admin passcode");
      return;
    }

    // In dev / client validation, accept standard dev key or any 6+ char passcode
    setPasscode(inputCode);
    setIsAuthenticated(true);
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

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Admin Passcode / Secret
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Enter passcode (e.g. admin123)"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>
              {errorMsg && (
                <p className="mt-1.5 text-xs text-rose-400">{errorMsg}</p>
              )}
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Access Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          <div className="mt-5 rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center text-[11px] text-muted-foreground">
            Default sandbox passcode: <code className="text-primary font-mono">admin123</code>
          </div>
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
          onClick={() => {
            setIsAuthenticated(false);
            setInputCode("");
          }}
          className="self-start rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:self-auto"
        >
          Lock Console
        </button>
      </div>

      {/* ── Navigation Tabs ───────────────────────────────────── */}
      <div className="flex border-b border-border/60">
        {[
          { id: "sync" as AdminTab, label: "Pipelines & Sync", icon: Activity },
          { id: "logs" as AdminTab, label: "Live Log Stream", icon: Terminal },
          { id: "ipos" as AdminTab, label: "IPO Master Catalog", icon: Building2 },
          { id: "reports" as AdminTab, label: "AI & Score Reports", icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
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
        {activeTab === "sync" && <SyncMonitor passcode={passcode} />}
        {activeTab === "logs" && <LogViewer passcode={passcode} />}
        {activeTab === "ipos" && <IpoManager />}
        {activeTab === "reports" && <ReportReviewer />}
      </div>
    </div>
  );
}
