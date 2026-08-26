// src/services/kfintech-sync.ts
// Background sync service: dynamically discovers active IPOs from KFintech.
//
// How it works:
//   1. Fetch https://ipostatus.kfintech.com/ (a React SPA)
//   2. Extract the content-hashed main JS bundle URL from the HTML
//   3. Download the bundle and extract the embedded JSON array of
//      { clientId, name } records (the same data that powers KFintech's
//      own IPO dropdown)
//   4. Cache in server memory (5-minute TTL) and persist a snapshot to the OS
//      temp dir as a fallback for cold starts / KFintech downtime
//
// No IPO names or client IDs are hardcoded anywhere — when KFintech adds
// a new IPO it appears here automatically on the next sync.

import axios from "axios";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { IPO } from "@/types/ipo.types";
import { log } from "./logger.service";

const KFINTECH_SITE_URL = "https://ipostatus.kfintech.com/";
const SYNC_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 30000;
// After a failed sync, wait before hitting KFintech live again — otherwise
// every request during an outage re-runs two full page/bundle downloads.
const FAILED_RETRY_COOLDOWN_MS = 60 * 1000;
// Log an escalated error after this many consecutive failures so a silently
// broken bundle format gets noticed.
const FAILURE_STREAK_ALERT_AT = 5;
const SNAPSHOT_FILE = path.join(os.tmpdir(), "kfintech-ipo-snapshot.json");

interface SyncState {
  ipos: IPO[];
  lastSyncedAt: number; // epoch ms of last successful sync
  syncing: Promise<IPO[]> | null;
  lastAttemptAt: number; // epoch ms of last live attempt (success or failure)
  failureStreak: number;
}

// globalThis so the cache survives module duplication across route bundles
const globalStore = globalThis as unknown as { __kfinSync?: SyncState };
globalStore.__kfinSync = globalStore.__kfinSync ?? {
  ipos: [],
  lastSyncedAt: 0,
  syncing: null,
  lastAttemptAt: 0,
  failureStreak: 0,
};
const state = globalStore.__kfinSync;

interface RawIPORecord {
  clientId: string;
  name: string;
}

function toIPO(raw: RawIPORecord, syncedAt: Date): IPO {
  return {
    id: `kfintech-${raw.clientId}`,
    clientId: raw.clientId,
    name: raw.name,
    registrar: "kfintech",
    status: "ACTIVE",
    lastSyncedAt: syncedAt.toISOString(),
  };
}

/**
 * Find a JSON array literal containing `marker` (e.g. "clientId") by
 * bracket-matching outward from the marker — tolerant of key order, extra
 * fields, and whitespace that fixed regexes choke on when the bundle is
 * rebuilt/reformatted.
 */
function extractJsonArrayContaining(
  source: string,
  marker: string
): string | null {
  let idx = source.indexOf(marker);
  while (idx !== -1) {
    const start = source.lastIndexOf("[", idx);
    if (start !== -1) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = start; i < source.length; i++) {
        const ch = source[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === "\\") escaped = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') inString = true;
        else if (ch === "[") depth++;
        else if (ch === "]") {
          depth--;
          if (depth === 0) return source.slice(start, i + 1);
        }
      }
    }
    idx = source.indexOf(marker, idx + 1);
  }
  return null;
}

/** Extract the IPO master list embedded in KFintech's SPA bundle. */
function parseIPOsFromBundle(bundleSource: string): RawIPORecord[] {
  // The array appears inside JSON.parse('...'), so quotes may be escaped —
  // the plain marker matches both forms ("clientId" is a substring of \"clientId\").
  const raw =
    extractJsonArrayContaining(bundleSource, '"clientId"') ??
    extractJsonArrayContaining(bundleSource, "clientId");
  if (!raw) {
    throw new Error("IPO list not found in KFintech bundle");
  }

  // Unescape if embedded in a string literal; otherwise parse as-is.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/\\"/g, '"').replace(/\\'/g, "'"));
  } catch {
    parsed = JSON.parse(raw);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Parsed IPO data is not an array");
  }

  const records: RawIPORecord[] = [];
  for (const item of parsed) {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as RawIPORecord).clientId === "string" &&
      typeof (item as RawIPORecord).name === "string"
    ) {
      records.push({
        clientId: (item as RawIPORecord).clientId.trim(),
        name: (item as RawIPORecord).name.trim(),
      });
    }
  }

  if (records.length === 0) {
    throw new Error("KFintech bundle contained an empty IPO list");
  }
  return records;
}

async function fetchIPOsFromKFintech(): Promise<RawIPORecord[]> {
  const http = axios.create({
    timeout: FETCH_TIMEOUT_MS,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" },
  });

  // Step 1: locate the content-hashed bundle from the SPA shell
  const html = (await http.get<string>(KFINTECH_SITE_URL)).data;
  const bundleMatch = html.match(/(?:\.\/)?(static\/js\/main\.[a-zA-Z0-9]+\.js)/);
  if (!bundleMatch) {
    throw new Error("Could not locate JS bundle in KFintech page");
  }

  // Step 2: download the bundle and extract the embedded IPO list
  const bundleUrl = new URL(bundleMatch[1], KFINTECH_SITE_URL).toString();
  const bundle = (await http.get<string>(bundleUrl)).data;
  return parseIPOsFromBundle(bundle);
}

async function saveSnapshot(ipos: IPO[]): Promise<void> {
  try {
    await fs.writeFile(SNAPSHOT_FILE, JSON.stringify({ ipos }), "utf-8");
  } catch {
    // Snapshot is best-effort; memory cache still works
  }
}

async function loadSnapshot(): Promise<IPO[] | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { ipos?: IPO[] };
    return Array.isArray(parsed.ipos) && parsed.ipos.length > 0
      ? parsed.ipos
      : null;
  } catch {
    return null;
  }
}

/**
 * Sync the active IPO list from KFintech. On failure, falls back to the
 * last successful result (memory cache, then disk snapshot).
 */
export async function syncActiveIPOs(): Promise<IPO[]> {
  // Coalesce concurrent sync requests into a single fetch
  if (state.syncing) return state.syncing;

  const started = Date.now();
  state.lastAttemptAt = started;
  state.syncing = (async () => {
    try {
      const raw = await fetchIPOsFromKFintech();
      const syncedAt = new Date();
      const ipos = raw.map((r) => toIPO(r, syncedAt));

      state.ipos = ipos;
      state.lastSyncedAt = syncedAt.getTime();
      state.failureStreak = 0;
      await saveSnapshot(ipos);

      log("info", "ipo_sync_success", `Synced ${ipos.length} active IPOs from KFintech`, {
        durationMs: Date.now() - started,
        meta: { count: ipos.length },
      });
      return ipos;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      state.failureStreak++;
      const escalate = state.failureStreak % FAILURE_STREAK_ALERT_AT === 0;
      log(
        escalate ? "error" : "warn",
        "ipo_sync_failure",
        `KFintech IPO sync failed (${state.failureStreak} consecutive): ${message}`,
        {
          durationMs: Date.now() - started,
        }
      );

      // Fallback 1: stale memory cache from a previous successful sync
      if (state.ipos.length > 0) {
        log("warn", "ipo_sync_fallback", "Serving stale in-memory IPO list");
        return state.ipos;
      }

      // Fallback 2: last persisted snapshot (cold start after downtime)
      const snapshot = await loadSnapshot();
      if (snapshot) {
        state.ipos = snapshot;
        log("warn", "ipo_sync_fallback", `Serving ${snapshot.length} IPOs from disk snapshot`);
        return snapshot;
      }

      throw new Error(`KFintech IPO sync failed and no cached data available: ${message}`);
    } finally {
      state.syncing = null;
    }
  })();

  return state.syncing;
}

/**
 * Get the active IPO list, syncing from KFintech when the 5-minute cache
 * has expired (or on first access after a cold start).
 */
export async function getActiveIPOs(forceRefresh = false): Promise<IPO[]> {
  const fresh =
    state.ipos.length > 0 && Date.now() - state.lastSyncedAt < SYNC_TTL_MS;

  if (!forceRefresh && fresh) {
    return state.ipos;
  }

  // Back off after a failed attempt instead of re-scraping on every request.
  const recentFailure =
    state.lastAttemptAt > 0 &&
    state.lastSyncedAt < state.lastAttemptAt &&
    Date.now() - state.lastAttemptAt < FAILED_RETRY_COOLDOWN_MS;

  if (!forceRefresh && recentFailure && !state.syncing) {
    return state.ipos;
  }

  return syncActiveIPOs();
}

/** ISO timestamp of the last successful sync, or null if never synced. */
export function getLastSyncedAt(): string | null {
  return state.lastSyncedAt > 0 ? new Date(state.lastSyncedAt).toISOString() : null;
}
