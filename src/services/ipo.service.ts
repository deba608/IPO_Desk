// src/services/ipo.service.ts
// Thin facade over the KFintech sync service. No IPO data is hardcoded —
// everything is discovered dynamically (see kfintech-sync.ts).

import { IPO, IPOListResponse } from "@/types/ipo.types";
import {
  getActiveIPOs as getSyncedIPOs,
  getLastSyncedAt,
} from "./kfintech-sync";

export async function getActiveIPOs(forceRefresh = false): Promise<IPOListResponse> {
  const ipos = await getSyncedIPOs(forceRefresh);

  return {
    ipos,
    total: ipos.length,
    lastUpdated: getLastSyncedAt() ?? new Date().toISOString(),
  };
}

export async function findIPOByClientId(clientId: string): Promise<IPO | undefined> {
  const ipos = await getSyncedIPOs();
  const found = ipos.find((ipo) => ipo.clientId === clientId);
  if (found) return found;

  // IPO may have been added since the last sync — refresh once and retry
  const refreshed = await getSyncedIPOs(true);
  return refreshed.find((ipo) => ipo.clientId === clientId);
}

export async function getRegistrarForIPO(clientId: string): Promise<string> {
  const ipo = await findIPOByClientId(clientId);
  return ipo?.registrar ?? "kfintech";
}
