// src/services/ipo.service.ts
import { IPO, IPOListResponse } from "@/types/ipo.types";
import { KFINTECH_ACTIVE_IPOS } from "@/data/kfintech-ipos";

// In-memory cache (for production, use Redis or Next.js cache)
let cachedIPOs: IPO[] | null = null;
let cacheTime: number | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getActiveIPOs(forceRefresh = false): Promise<IPOListResponse> {
  const now = Date.now();

  if (!forceRefresh && cachedIPOs && cacheTime && now - cacheTime < CACHE_TTL_MS) {
    return {
      ipos: cachedIPOs,
      total: cachedIPOs.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    };
  }

  // Primary source: local data file (updated from KFintech bundle)
  // Future: implement real-time bundle scraping here
  const ipos = KFINTECH_ACTIVE_IPOS;

  cachedIPOs = ipos;
  cacheTime = now;

  return {
    ipos,
    total: ipos.length,
    lastUpdated: new Date(now).toISOString(),
  };
}

export function findIPOByClientId(clientId: string): IPO | undefined {
  return KFINTECH_ACTIVE_IPOS.find((ipo) => ipo.clientId === clientId);
}

export function getRegistrarForIPO(clientId: string): string {
  const ipo = findIPOByClientId(clientId);
  return ipo?.registrar ?? "kfintech";
}
