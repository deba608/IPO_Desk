"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { BrokerKey } from "@/features/ipo-apply/lib/brokers";
import { isValidPAN } from "@/features/ipo-apply/lib/brokers";

export interface ApplyAccount {
  id: string;
  label: string;
  pan: string;
  broker: BrokerKey;
  dematId?: string;
  upiId?: string;
}

const STORAGE_KEY = "ipodesk:apply-accounts";
const CHANGE_EVENT = "ipodesk:apply-accounts-change";

function readStore(): ApplyAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is ApplyAccount =>
        !!a && typeof a.id === "string" && typeof a.label === "string" && typeof a.pan === "string"
    );
  } catch {
    return [];
  }
}

function writeStore(accounts: ApplyAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Storage unavailable
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// Stable snapshot (same pattern as useProfiles — avoids infinite loops).
let cachedRaw: string | null | undefined;
let cachedAccounts: ApplyAccount[] = [];

function getSnapshot(): ApplyAccount[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedAccounts = readStore();
  }
  return cachedAccounts;
}

const EMPTY: ApplyAccount[] = [];
function getServerSnapshot(): ApplyAccount[] {
  return EMPTY;
}

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  }
}

export interface NewApplyAccount {
  label: string;
  pan: string;
  broker: BrokerKey;
  dematId?: string;
  upiId?: string;
}

export function useApplyAccounts() {
  const accounts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((input: NewApplyAccount): { ok: boolean; error?: string } => {
    const pan = input.pan.trim().toUpperCase();
    if (!isValidPAN(pan)) return { ok: false, error: "Invalid PAN format (e.g. ABCDE1234F)." };
    if (!input.label.trim()) return { ok: false, error: "Label is required (e.g. Self, Spouse)." };
    const current = readStore();
    if (current.some((a) => a.pan === pan))
      return { ok: false, error: "This PAN is already saved (one PAN = one account)." };
    writeStore([
      ...current,
      {
        id: makeId(),
        label: input.label.trim(),
        pan,
        broker: input.broker,
        dematId: input.dematId?.trim() || undefined,
        upiId: input.upiId?.trim() || undefined,
      },
    ]);
    return { ok: true };
  }, []);

  const update = useCallback((id: string, input: NewApplyAccount): { ok: boolean; error?: string } => {
    const pan = input.pan.trim().toUpperCase();
    if (!isValidPAN(pan)) return { ok: false, error: "Invalid PAN format." };
    const current = readStore();
    if (current.some((a) => a.id !== id && a.pan === pan))
      return { ok: false, error: "Another account already uses this PAN." };
    writeStore(
      current.map((a) =>
        a.id === id
          ? {
              ...a,
              label: input.label.trim() || a.label,
              pan,
              broker: input.broker,
              dematId: input.dematId?.trim() || undefined,
              upiId: input.upiId?.trim() || undefined,
            }
          : a
      )
    );
    return { ok: true };
  }, []);

  const remove = useCallback((id: string) => {
    writeStore(readStore().filter((a) => a.id !== id));
  }, []);

  const clear = useCallback(() => {
    writeStore([]);
  }, []);

  return { accounts, add, update, remove, clear, count: accounts.length, hydrated: true };
}
