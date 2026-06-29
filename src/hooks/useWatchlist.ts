"use client";

// useWatchlist — client-side IPO watchlist persisted in localStorage.
//
// State is shared across every component instance (cards, tabs, counters) via a
// custom "watchlist-change" window event plus the native "storage" event so it
// also syncs across browser tabs. SSR-safe: localStorage is only touched inside
// effects/handlers, never during render.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ipodesk:watchlist";
const CHANGE_EVENT = "ipodesk:watchlist-change";

function readStore(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeStore(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    // Notify same-tab listeners (the native "storage" event only fires in OTHER tabs).
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Storage unavailable (private mode / quota) — fail silently.
  }
}

export function useWatchlist() {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-time hydration from localStorage after mount (SSR has no storage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds(readStore());
    setHydrated(true);

    const sync = () => setIds(readStore());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = readStore();
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    writeStore(next);
    setIds(next);
  }, []);

  const isWatched = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, count: ids.length, isWatched, toggle, hydrated };
}
