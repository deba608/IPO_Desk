"use client";

import { useState } from "react";
import { Bell, BellOff, TrendingUp, BarChart3, Calendar, ClipboardCheck, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAlerts, type AlertTrigger } from "@/hooks/useAlerts";

const TRIGGER_LABELS: Record<AlertTrigger, string> = {
  ipo_opens: "IPO Opens",
  gmp_crossed: "GMP crosses ₹",
  subscription_milestone: "Subscription hits ×",
  allotment_available: "Allotment declared",
};

const TRIGGER_ICONS: Record<AlertTrigger, typeof Bell> = {
  ipo_opens: Calendar,
  gmp_crossed: TrendingUp,
  subscription_milestone: BarChart3,
  allotment_available: ClipboardCheck,
};

// Triggers that need a numeric threshold from the user.
const THRESHOLD_TRIGGERS: AlertTrigger[] = ["gmp_crossed", "subscription_milestone"];

interface AlertSettingsProps {
  ipoId: string;
  ipoName: string;
}

export function AlertSettings({ ipoId, ipoName }: AlertSettingsProps) {
  const { alertsForIpo, addAlert, removeAlert, toggleAlert, dbBacked } = useAlerts();
  const ipoAlerts = alertsForIpo(ipoId);
  const [pendingTrigger, setPendingTrigger] = useState<AlertTrigger | null>(null);
  const [thresholdInput, setThresholdInput] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const hasTrigger = (trigger: AlertTrigger) =>
    ipoAlerts.some((a) => a.trigger === trigger);

  const fail = (msg: string) => {
    setFormError(msg);
    setBusy(false);
  };

  const handleTriggerClick = async (trigger: AlertTrigger) => {
    setFormError("");
    const existing = ipoAlerts.find((a) => a.trigger === trigger);
    if (existing) {
      setBusy(true);
      const ok = await removeAlert(existing.id);
      if (!ok) fail("Could not remove alert. Please try again.");
      else {
        setBusy(false);
        if (pendingTrigger === trigger) setPendingTrigger(null);
      }
      return;
    }
    if (THRESHOLD_TRIGGERS.includes(trigger)) {
      // Expand the inline threshold input instead of creating immediately.
      setPendingTrigger(pendingTrigger === trigger ? null : trigger);
      setThresholdInput("");
      return;
    }
    setBusy(true);
    const ok = await addAlert(ipoId, ipoName, trigger);
    if (!ok) fail("Could not save alert. Please try again.");
    else setBusy(false);
  };

  const handleThresholdConfirm = async (trigger: AlertTrigger) => {
    const value = Number(thresholdInput);
    if (!Number.isFinite(value) || value <= 0 || value > 100000) {
      setFormError("Enter a valid number above 0");
      return;
    }
    setBusy(true);
    const ok = await addAlert(ipoId, ipoName, trigger, value);
    if (!ok) {
      fail("Could not save alert. It may already exist.");
      return;
    }
    setBusy(false);
    setPendingTrigger(null);
    setThresholdInput("");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {ipoAlerts.length > 0 ? (
            <>
              <Bell className="h-4 w-4 text-primary" />
              <span>{ipoAlerts.length}</span>
            </>
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs">Alerts</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Set Alerts</p>
            <p className="text-xs text-muted-foreground">
              Get notified about {ipoName}
              {!dbBacked && " (saved on this device)"}
            </p>
          </div>

          {formError && (
            <p className="text-xs text-rose-400">{formError}</p>
          )}

          <div className="space-y-1.5">
            {(Object.keys(TRIGGER_LABELS) as AlertTrigger[]).map((trigger) => {
              const Icon = TRIGGER_ICONS[trigger];
              const active = hasTrigger(trigger);
              const expanded = pendingTrigger === trigger && !active;
              return (
                <div key={trigger}>
                  <button
                    disabled={busy}
                    onClick={() => handleTriggerClick(trigger)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                      active
                        ? "border-primary/30 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                    <span className="flex-1">{TRIGGER_LABELS[trigger]}</span>
                    {active && <Bell className="h-3.5 w-3.5 text-primary" />}
                  </button>
                  {expanded && (
                    <div className="mt-1.5 flex items-center gap-1.5 pl-1">
                      <input
                        type="number"
                        min="0"
                        inputMode="decimal"
                        autoFocus
                        placeholder={trigger === "gmp_crossed" ? "e.g. 50 (₹)" : "e.g. 10 (×)"}
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleThresholdConfirm(trigger);
                        }}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                      <button
                        disabled={busy}
                        onClick={() => handleThresholdConfirm(trigger)}
                        aria-label="Save alert"
                        className="rounded-lg bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {ipoAlerts.length > 0 && (
            <>
              <div className="border-t border-border pt-2">
                <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                  Active Alerts
                </p>
                {ipoAlerts.map((alert) => {
                  const Icon = TRIGGER_ICONS[alert.trigger];
                  return (
                    <div
                      key={alert.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
                    >
                      <Icon className="h-3 w-3 text-primary" />
                      <span className="flex-1 text-foreground">
                        {TRIGGER_LABELS[alert.trigger]}
                        {alert.threshold !== undefined && ` ${alert.threshold}`}
                      </span>
                      {!alert.enabled && (
                        <Badge variant="outline" className="text-[9px]">OFF</Badge>
                      )}
                      <button
                        onClick={async () => {
                          setBusy(true);
                          const ok = await toggleAlert(alert.id);
                          setBusy(false);
                          if (!ok) setFormError("Could not update alert.");
                        }}
                        aria-label={alert.enabled ? "Disable alert" : "Enable alert"}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {alert.enabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={async () => {
                          setBusy(true);
                          const ok = await removeAlert(alert.id);
                          setBusy(false);
                          if (!ok) setFormError("Could not remove alert.");
                        }}
                        aria-label="Remove alert"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
