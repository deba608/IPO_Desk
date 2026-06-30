"use client";

// useCheckHistory — local log of past allotment checks & scans, persisted in
// localStorage and synced across tabs (same pattern as useWatchlist). Lets a
// user revisit what they checked and see win/loss stats over time. Capped to
// MAX_ENTRIES most-recent records so storage never grows unbounded.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ipodesk:check-history";
const CHANGE_EVENT = "ipodesk:check-history-change";
const MAX_ENTRIES = 100;

export interface HistoryEntry {
  id: string;
  type: "check" | "scan";
  /** ISO timestamp of the check. */
  at: string;
  /** IPO name (single check) or "N IPOs" (scan). */
  label: string;
  /** Registrar for single checks; omitted for scans. */
  registrar?: string;
  /** Distinct PANs checked. */
  pansChecked: number;
  /**
   * Single check: PANs allotted. Scan: IPOs where ≥1 PAN was allotted.
   */
  allotted: number;
  /**
   * Single check: total PANs. Scan: IPOs scanned.
   */
  total: number;
  /** Scan only: IPOs the PAN(s) actually applied to. */
  appliedTo?: number;
}

function readStore(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStore(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Storage unavailable (private mode / quota) — fail silently.
  }
}

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  }
}

export function useCheckHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(readStore());
    setHydrated(true);

    const sync = () => setEntries(readStore());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /** Prepend a new record (newest first), trimmed to MAX_ENTRIES. */
  const add = useCallback((entry: Omit<HistoryEntry, "id" | "at">) => {
    const record: HistoryEntry = {
      ...entry,
      id: makeId(),
      at: new Date().toISOString(),
    };
    const next = [record, ...readStore()].slice(0, MAX_ENTRIES);
    writeStore(next);
    setEntries(next);
  }, []);

  const remove = useCallback((id: string) => {
    const next = readStore().filter((e) => e.id !== id);
    writeStore(next);
    setEntries(next);
  }, []);

  const clear = useCallback(() => {
    writeStore([]);
    setEntries([]);
  }, []);

  return { entries, add, remove, clear, count: entries.length, hydrated };
}
