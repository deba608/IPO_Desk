"use client";

import { useCallback, useEffect, useState } from "react";

export type AlertTrigger = "ipo_opens" | "gmp_crossed" | "subscription_milestone" | "allotment_available";

export interface AlertRule {
  id: string;
  ipoId: string;
  ipoName: string;
  trigger: AlertTrigger;
  threshold?: number;
  enabled: boolean;
  createdAt: string;
}

const STORAGE_KEY = "ipodesk:alerts";

function load(): AlertRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(alerts: AlertRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAlerts(load());
    setHydrated(true);
  }, []);

  const addAlert = useCallback(
    (ipoId: string, ipoName: string, trigger: AlertTrigger, threshold?: number) => {
      const updated = [
        ...alerts,
        {
          id: crypto.randomUUID(),
          ipoId,
          ipoName,
          trigger,
          threshold,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ];
      setAlerts(updated);
      save(updated);
    },
    [alerts]
  );

  const removeAlert = useCallback(
    (id: string) => {
      const updated = alerts.filter((a) => a.id !== id);
      setAlerts(updated);
      save(updated);
    },
    [alerts]
  );

  const toggleAlert = useCallback(
    (id: string) => {
      const updated = alerts.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      );
      setAlerts(updated);
      save(updated);
    },
    [alerts]
  );

  const alertsForIpo = useCallback(
    (ipoId: string) => alerts.filter((a) => a.ipoId === ipoId),
    [alerts]
  );

  return { alerts, hydrated, addAlert, removeAlert, toggleAlert, alertsForIpo };
}
