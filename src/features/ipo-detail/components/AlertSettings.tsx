"use client";

import { Bell, BellOff, BellPlus, TrendingUp, BarChart3, Calendar, ClipboardCheck, X } from "lucide-react";
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

interface AlertSettingsProps {
  ipoId: string;
  ipoName: string;
}

export function AlertSettings({ ipoId, ipoName }: AlertSettingsProps) {
  const { alerts, alertsForIpo, addAlert, removeAlert, toggleAlert } = useAlerts();
  const ipoAlerts = alertsForIpo(ipoId);

  const hasTrigger = (trigger: AlertTrigger) =>
    ipoAlerts.some((a) => a.trigger === trigger);

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
            <p className="text-xs text-muted-foreground">Get notified about {ipoName}</p>
          </div>

          <div className="space-y-1.5">
            {(Object.keys(TRIGGER_LABELS) as AlertTrigger[]).map((trigger) => {
              const Icon = TRIGGER_ICONS[trigger];
              const active = hasTrigger(trigger);
              return (
                <button
                  key={trigger}
                  onClick={() => {
                    if (active) {
                      const existing = ipoAlerts.find((a) => a.trigger === trigger);
                      if (existing) removeAlert(existing.id);
                    } else {
                      addAlert(ipoId, ipoName, trigger);
                    }
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "border-primary/30 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                  <span className="flex-1">{TRIGGER_LABELS[trigger]}</span>
                  {active && <Bell className="h-3.5 w-3.5 text-primary" />}
                </button>
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
                        onClick={() => toggleAlert(alert.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {alert.enabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={() => removeAlert(alert.id)}
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
