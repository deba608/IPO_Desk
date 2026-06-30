"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ipodesk:profiles";
const CHANGE_EVENT = "ipodesk:profiles-change";

export interface PanProfile {
  id: string;
  name: string;
  pans: string[];
}

function readStore(): PanProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PanProfile[]) : [];
  } catch {
    return [];
  }
}

function writeStore(profiles: PanProfile[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Storage unavailable
  }
}

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  }
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<PanProfile[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProfiles(readStore());
    setHydrated(true);

    const sync = () => setProfiles(readStore());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = useCallback((name: string, pans: string[]) => {
    const next = [
      ...readStore(),
      {
        id: makeId(),
        name: name.trim(),
        pans: pans.map((p) => p.trim().toUpperCase()),
      },
    ];
    writeStore(next);
    setProfiles(next);
  }, []);

  const update = useCallback((id: string, name: string, pans: string[]) => {
    const next = readStore().map((p) =>
      p.id === id
        ? {
            ...p,
            name: name.trim(),
            pans: pans.map((x) => x.trim().toUpperCase()),
          }
        : p
    );
    writeStore(next);
    setProfiles(next);
  }, []);

  const remove = useCallback((id: string) => {
    const next = readStore().filter((p) => p.id !== id);
    writeStore(next);
    setProfiles(next);
  }, []);

  return {
    profiles,
    add,
    update,
    remove,
    count: profiles.length,
    hydrated,
  };
}
