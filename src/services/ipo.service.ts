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
  if (found) return found;

  // IPO may have been added since the last sync — refresh once and retry
  return lookup(await getAllActiveIPOs(true));
}

export async function getRegistrarForIPO(idOrClientId: string): Promise<string> {
  const ipo = await findIPO(idOrClientId);
  return ipo?.registrar ?? "kfintech";
}
