"use client";

// usePanLabels — client-side PAN → nickname map persisted in localStorage.
//
// Lets a user label PANs (e.g. "Self", "Spouse", "HUF", "Dad") so results read
// like people instead of opaque PANs. Mirrors useWatchlist: state is shared
// across every component instance via a custom "pan-labels-change" window event
// plus the native "storage" event for cross-tab sync. SSR-safe — localStorage is
// only touched inside effects/handlers, never during render.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ipodesk:pan-labels";
const CHANGE_EVENT = "ipodesk:pan-labels-change";

export type PanLabels = Record<string, string>;

function readStore(): PanLabels {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: PanLabels = {};
    for (const [pan, label] of Object.entries(parsed)) {
      if (typeof label === "string" && label.trim()) out[pan] = label;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(labels: PanLabels): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
    // Notify same-tab listeners (the native "storage" event only fires in OTHER tabs).
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Storage unavailable (private mode / quota) — fail silently.
  }
}

export function usePanLabels() {
  const [labels, setLabels] = useState<PanLabels>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-time hydration from localStorage after mount (SSR has no storage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabels(readStore());
    setHydrated(true);

    const sync = () => setLabels(readStore());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /** Set or clear a label. Empty/whitespace label removes the entry. */
  const setLabel = useCallback((pan: string, label: string) => {
    const current = readStore();
    const trimmed = label.trim();
    const next = { ...current };
    if (trimmed) next[pan] = trimmed;
    else delete next[pan];
    writeStore(next);
    setLabels(next);
  }, []);

  const getLabel = useCallback((pan: string) => labels[pan], [labels]);

  return { labels, getLabel, setLabel, count: Object.keys(labels).length, hydrated };
}
