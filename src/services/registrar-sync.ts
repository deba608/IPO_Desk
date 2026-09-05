// src/services/registrar-sync.ts
// Multi-registrar IPO catalogue sync with per-registrar fault isolation.
//
// Each registrar adapter is synced independently: a failure at one registrar
// never hides IPOs from the others. Per-registrar fallback chain:
//   live fetch → stale in-memory cache → disk snapshot → empty list
// (KFintech additionally keeps its own bundle-scraping cache inside
// kfintech-sync.ts; this layer treats every adapter uniformly.)

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { IPO } from "@/types/ipo.types";
import { listAdapters } from "@/registrars/registry";
import { log } from "./logger.service";

// Short TTL so newly opened allotments appear within minutes; checks
// themselves always hit the registrar live per request.
const SYNC_TTL_MS = 5 * 60 * 1000; // 5 minutes

// After a failed (or suspiciously empty) sync, wait this long before hitting
// the registrar live again — otherwise every incoming request re-fires the
// full retry cascade against a failing site.
const FAILED_RETRY_COOLDOWN_MS = 60 * 1000;

// Consecutive empty results tolerated before accepting an empty catalogue
// (a single empty response is far more likely a parser break than reality).
const EMPTY_RESULTS_BEFORE_ACCEPT = 3;

// Hard cap per registrar sync so one stalled upstream can never hold a
// user-facing request (IPO list or allotment check) hostage. On timeout the
// normal fallback chain below serves stale cache → disk snapshot → empty.
const SYNC_TIMEOUT_MS = 15_000;

/**
 * Race a promise against a timer. A loser that settles late is pre-handled
 * so it can never surface as an unhandled rejection.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  promise.catch(() => {});
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("sync timed out")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

interface RegistrarSyncState {
  ipos: IPO[];
  lastSyncedAt: number; // epoch ms of last successful sync (0 = never)
  syncing: Promise<IPO[]> | null;
  lastAttemptAt: number; // epoch ms of last live attempt (success or failure)
  emptyResults: number; // consecutive empty results from the adapter
}

function newState(): RegistrarSyncState {
  return { ipos: [], lastSyncedAt: 0, syncing: null, lastAttemptAt: 0, emptyResults: 0 };
}

// globalThis so the cache survives module duplication across route bundles
const globalStore = globalThis as unknown as {
  __registrarSync?: Map<string, RegistrarSyncState>;
};
globalStore.__registrarSync = globalStore.__registrarSync ?? new Map();
const stateByRegistrar = globalStore.__registrarSync;

function getState(registrar: string): RegistrarSyncState {
  let state = stateByRegistrar.get(registrar);
  if (!state) {
    state = newState();
    stateByRegistrar.set(registrar, state);
  }
  return state;
}

function snapshotFile(registrar: string): string {
  return path.join(os.tmpdir(), `registrar-ipo-snapshot-${registrar}.json`);
}

async function saveSnapshot(registrar: string, ipos: IPO[]): Promise<void> {
  if (ipos.length === 0) return;
  try {
    await fs.writeFile(snapshotFile(registrar), JSON.stringify({ ipos }), "utf-8");
  } catch {
    // Snapshot is best-effort; memory cache still works
  }
}

async function loadSnapshot(registrar: string): Promise<IPO[] | null> {
  try {
    const raw = await fs.readFile(snapshotFile(registrar), "utf-8");
    const parsed = JSON.parse(raw) as { ipos?: IPO[] };
    return Array.isArray(parsed.ipos) && parsed.ipos.length > 0 ? parsed.ipos : null;
  } catch {
    return null;
  }
}

async function syncRegistrar(registrar: string): Promise<IPO[]> {
  const state = getState(registrar);
  if (state.syncing) return state.syncing;

  const adapter = listAdapters().find((a) => a.name === registrar);
  if (!adapter) return [];

  const started = Date.now();
  state.lastAttemptAt = started;
  state.syncing = (async () => {
    try {
      const ipos = await withTimeout(adapter.getActiveIPOs(), SYNC_TIMEOUT_MS);

      // A parser break or site redesign returning zero rows must not wipe a
      // known-good catalogue and serve "fresh" emptiness for a full TTL.
      if (ipos.length === 0 && state.ipos.length > 0) {
        state.emptyResults++;
        if (state.emptyResults < EMPTY_RESULTS_BEFORE_ACCEPT) {
          log(
            "warn",
            "ipo_sync_empty",
            `${registrar} returned 0 IPOs — keeping previous list of ${state.ipos.length} (${state.emptyResults}/${EMPTY_RESULTS_BEFORE_ACCEPT})`
          );
          return state.ipos;
        }
        log(
          "warn",
          "ipo_sync_empty",
          `${registrar} returned 0 IPOs ${EMPTY_RESULTS_BEFORE_ACCEPT} times in a row — accepting empty catalogue`
        );
      } else {
        state.emptyResults = 0;
      }

      state.ipos = ipos;
      state.lastSyncedAt = Date.now();
      await saveSnapshot(registrar, ipos);
      return ipos;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log("error", "ipo_sync_failure", `${registrar} IPO sync failed: ${message}`, {
        durationMs: Date.now() - started,
        meta: { registrar },
      });

      if (state.ipos.length > 0) {
        log("warn", "ipo_sync_fallback", `Serving stale in-memory IPO list for ${registrar}`);
        return state.ipos;
      }

      const snapshot = await loadSnapshot(registrar);
      if (snapshot) {
        state.ipos = snapshot;
        log("warn", "ipo_sync_fallback", `Serving ${snapshot.length} IPOs from disk snapshot for ${registrar}`);
        return snapshot;
      }

      // Fault isolation: this registrar contributes nothing this round,
      // but the others still serve their catalogues.
      return [];
    } finally {
      state.syncing = null;
    }
  })();

  return state.syncing;
}

async function getRegistrarIPOs(registrar: string, forceRefresh: boolean): Promise<IPO[]> {
  const state = getState(registrar);
  const fresh =
    state.lastSyncedAt > 0 && Date.now() - state.lastSyncedAt < SYNC_TTL_MS;

  if (!forceRefresh && fresh) {
    return state.ipos;
  }

  // A failed attempt leaves lastSyncedAt older than lastAttemptAt — back off
  // instead of re-scraping a failing registrar on every request.
  const recentFailure =
    state.lastAttemptAt > 0 &&
    state.lastSyncedAt < state.lastAttemptAt &&
    Date.now() - state.lastAttemptAt < FAILED_RETRY_COOLDOWN_MS;

  if (!forceRefresh && recentFailure && state.syncing === null) {
    return state.ipos;
  }

  return syncRegistrar(registrar);
}

/**
 * Merged active-IPO catalogue across every registered adapter. Registrars
 * are synced in parallel and independently.
 */
export async function getAllActiveIPOs(forceRefresh = false): Promise<IPO[]> {
  const registrars = listAdapters().map((a) => a.name);
  const results = await Promise.all(
    registrars.map((r) => getRegistrarIPOs(r, forceRefresh))
  );
  return results.flat();
}

/** Force a sync of every registrar; returns per-registrar counts. */
export async function syncAllRegistrars(): Promise<Record<string, number>> {
  const registrars = listAdapters().map((a) => a.name);
  const results = await Promise.all(registrars.map((r) => syncRegistrar(r)));
  return Object.fromEntries(registrars.map((r, i) => [r, results[i].length]));
}

/** ISO timestamp of the most recent successful sync across registrars. */
export function getLastSyncedAt(): string | null {
  let latest = 0;
  for (const state of stateByRegistrar.values()) {
    if (state.lastSyncedAt > latest) latest = state.lastSyncedAt;
  }
  return latest > 0 ? new Date(latest).toISOString() : null;
}
