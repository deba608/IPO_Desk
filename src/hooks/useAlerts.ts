"use client";

import { useCallback, useSyncExternalStore } from "react";

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
const CHANGE_EVENT = "ipodesk:alerts-change";

function load(): AlertRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Cached snapshot — useSyncExternalStore requires getSnapshot to return the
// same reference when nothing has changed, otherwise it loops infinitely.
let cachedSnapshot: AlertRule[] = [];
let cachedRaw: string | null = null;

function refreshCache(): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = raw ? (JSON.parse(raw) as AlertRule[]) : [];
  }
}

function save(alerts: AlertRule[]): void {
  try {
    const json = JSON.stringify(alerts);
    localStorage.setItem(STORAGE_KEY, json);
    // Update cache immediately so the next getSnapshot() is consistent.
    cachedRaw = json;
    cachedSnapshot = alerts;
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // quota exceeded — silently ignore
  }
}

function subscribe(callback: () => void): () => void {
  // Seed the cache on first subscribe (component mount).
  refreshCache();
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): AlertRule[] {
  refreshCache();
  return cachedSnapshot;
}

function getServerSnapshot(): AlertRule[] {
  return [];
}

export function useAlerts() {
  const alerts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const addAlert = useCallback(
    (ipoId: string, ipoName: string, trigger: AlertTrigger, threshold?: number) => {
      const current = load();
      const updated = [
        ...current,
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
      save(updated);
    },
    []
  );

  const removeAlert = useCallback((id: string) => {
    const current = load();
    const updated = current.filter((a) => a.id !== id);
    save(updated);
  }, []);

  const toggleAlert = useCallback((id: string) => {
    const current = load();
    const updated = current.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    save(updated);
  }, []);

  const alertsForIpo = useCallback(
    (ipoId: string) => alerts.filter((a) => a.ipoId === ipoId),
    [alerts]
  );

  return { alerts, hydrated: true, addAlert, removeAlert, toggleAlert, alertsForIpo };
}
