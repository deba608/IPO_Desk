"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

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
const DEVICE_KEY = "ipodesk:device-id";
const CHANGE_EVENT = "ipodesk:alerts-change";

/** Stable anonymous device id for the server alerts API (x-device-id). */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

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

const EMPTY: AlertRule[] = [];

function getServerSnapshot(): AlertRule[] {
  return EMPTY;
}

function makeId(): string {
  // crypto.randomUUID is only available in secure contexts.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ServerAlert {
  id: string;
  ipoId: string;
  trigger: AlertTrigger;
  threshold?: number | null;
  enabled: boolean;
  createdAt: string;
  ipo?: { name?: string; slug?: string } | null;
}

/** The API stores the internal IPO id; the UI matches on the public slug. */
function toRule(item: ServerAlert, fallbackName: string): AlertRule {
  return {
    id: item.id,
    ipoId: item.ipo?.slug ?? item.ipoId,
    ipoName: item.ipo?.name ?? fallbackName,
    trigger: item.trigger,
    threshold: item.threshold ?? undefined,
    enabled: item.enabled,
    createdAt: item.createdAt,
  };
}

export function useAlerts() {
  const localAlerts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // null = server state unknown yet; [] = server confirmed empty.
  const [serverRules, setServerRules] = useState<AlertRule[] | null>(null);
  const [dbBacked, setDbBacked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const deviceId = getDeviceId();
      if (!deviceId) return;
      try {
        const res = await fetch("/api/alerts", {
          headers: { "x-device-id": deviceId },
        });
        // 503 (no DB) or 401 → stay on the localStorage fallback.
        if (!res.ok) return;
        const data = (await res.json()) as { alerts?: ServerAlert[] };
        if (cancelled) return;
        setServerRules((data.alerts ?? []).map((a) => toRule(a, "")));
        setDbBacked(true);
      } catch {
        // Offline / unreachable — local fallback keeps working.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const alerts = dbBacked && serverRules ? serverRules : localAlerts;

  const addAlert = useCallback(
    async (
      ipoId: string,
      ipoName: string,
      trigger: AlertTrigger,
      threshold?: number
    ): Promise<boolean> => {
      if (dbBacked) {
        try {
          const res = await fetch("/api/alerts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-device-id": getDeviceId(),
            },
            body: JSON.stringify({ ipoId, trigger, threshold }),
          });
          if (!res.ok) return false;
          const data = (await res.json()) as { alert: ServerAlert };
          setServerRules((prev) => [...(prev ?? []), toRule(data.alert, ipoName)]);
          return true;
        } catch {
          return false;
        }
      }
      const current = load();
      const updated = [
        ...current,
        {
          id: makeId(),
          ipoId,
          ipoName,
          trigger,
          threshold,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ];
      save(updated);
      return true;
    },
    [dbBacked]
  );

  const removeAlert = useCallback(
    async (id: string): Promise<boolean> => {
      if (dbBacked) {
        try {
          const res = await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: { "x-device-id": getDeviceId() },
          });
          if (!res.ok) return false;
          setServerRules((prev) => (prev ?? []).filter((a) => a.id !== id));
          return true;
        } catch {
          return false;
        }
      }
      const current = load();
      const updated = current.filter((a) => a.id !== id);
      save(updated);
      return true;
    },
    [dbBacked]
  );

  const toggleAlert = useCallback(
    async (id: string): Promise<boolean> => {
      if (dbBacked) {
        const current = (serverRules ?? []).find((a) => a.id === id);
        if (!current) return false;
        try {
          const res = await fetch("/api/alerts", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-device-id": getDeviceId(),
            },
            body: JSON.stringify({ id, enabled: !current.enabled }),
          });
          if (!res.ok) return false;
          setServerRules((prev) =>
            (prev ?? []).map((a) =>
              a.id === id ? { ...a, enabled: !a.enabled } : a
            )
          );
          return true;
        } catch {
          return false;
        }
      }
      const current = load();
      const updated = current.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      );
      save(updated);
      return true;
    },
    [dbBacked, serverRules]
  );

  const alertsForIpo = useCallback(
    (ipoId: string) => alerts.filter((a) => a.ipoId === ipoId),
    [alerts]
  );

  return {
    alerts,
    hydrated: true,
    dbBacked,
    addAlert,
    removeAlert,
    toggleAlert,
    alertsForIpo,
  };
}
