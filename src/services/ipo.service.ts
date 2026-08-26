// src/services/ipo.service.ts
// Unified IPO catalogue across all registrars. No IPO data is hardcoded —
// every adapter discovers its list dynamically (see registrar-sync.ts).

import { IPO, IPOListResponse } from "@/types/ipo.types";
import {
  getAllActiveIPOs,
  getLastSyncedAt,
} from "./registrar-sync";

export async function getActiveIPOs(forceRefresh = false): Promise<IPOListResponse> {
  const ipos = await getAllActiveIPOs(forceRefresh);

  return {
    ipos,
    total: ipos.length,
    lastUpdated: getLastSyncedAt() ?? new Date().toISOString(),
  };
}

// Negative cache: an id that isn't found even after a forced refresh is
// remembered briefly so garbage ids can't trigger a full registrar re-scrape
// on every request.
const NEGATIVE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_CACHE_MAX = 1000;

const globalStore = globalThis as unknown as {
  __ipoNegativeCache?: Map<string, number>;
};
globalStore.__ipoNegativeCache = globalStore.__ipoNegativeCache ?? new Map();
const negativeCache = globalStore.__ipoNegativeCache;

/**
 * Resolve an IPO by its namespaced id (`${registrar}-${clientId}`, preferred)
 * or bare registrar clientId (legacy clients; ambiguous if two registrars
 * reuse the same numeric id, in which case the first match wins).
 */
export async function findIPO(idOrClientId: string): Promise<IPO | undefined> {
  const lookup = (ipos: IPO[]) =>
    ipos.find((ipo) => ipo.id === idOrClientId) ??
    ipos.find((ipo) => ipo.clientId === idOrClientId);

  const found = lookup(await getAllActiveIPOs());
  if (found) {
    negativeCache.delete(idOrClientId);
    return found;
  }

  const missedAt = negativeCache.get(idOrClientId);
  if (missedAt && Date.now() - missedAt < NEGATIVE_TTL_MS) {
    return undefined;
  }

  // IPO may have been added since the last sync — refresh once and retry.
  // Keep the map bounded; it only ever holds misses, so a full reset is fine.
  if (negativeCache.size >= NEGATIVE_CACHE_MAX) negativeCache.clear();
  const refreshed = lookup(await getAllActiveIPOs(true));
  negativeCache.set(idOrClientId, Date.now());
  return refreshed;
}

export async function getRegistrarForIPO(idOrClientId: string): Promise<string> {
  const ipo = await findIPO(idOrClientId);
  return ipo?.registrar ?? "kfintech";
}
