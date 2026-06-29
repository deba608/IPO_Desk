// src/features/ipo-calendar/lib/providers/index.ts
// Provider registry: selects the live provider when configured, otherwise the
// seed provider, and caches results in-memory with a TTL so we stay well under
// upstream rate limits (IPO Guru: 15/min, 300/day) and serve fast.
//
// On a live-provider failure we fall back to the seed catalogue rather than
// erroring the whole calendar.

import { CalendarIPO, DataSource } from "@/types/calendar.types";
import { CalendarProvider } from "./types";
import { seedProvider } from "./seed.provider";
import { createIpoGuruProvider } from "./ipoguru.provider";
import { createNseProvider } from "./nse.provider";

export interface CatalogueResult {
  ipos: CalendarIPO[];
  source: DataSource;
}

const TTL_MS = 60 * 1000; // 1 minute — matches client polling interval

let cache: { at: number; result: CatalogueResult } | null = null;

// Live-source priority: IPO Guru (richest: GMP + subscription) when a key is
// configured, otherwise NSE official (no key, no GMP). Seed is only reached via
// the failure fallback in loadCatalogue().
function selectProvider(): CalendarProvider {
  const key = process.env.IPOGURU_API_KEY?.trim();
  if (key) return createIpoGuruProvider(key);
  return createNseProvider();
}

/** Returns the IPO catalogue + its source, cached for TTL_MS. */
export async function loadCatalogue(forceRefresh = false): Promise<CatalogueResult> {
  if (!forceRefresh && cache && Date.now() - cache.at < TTL_MS) {
    return cache.result;
  }

  const provider = selectProvider();
  try {
    const ipos = await provider.fetchCatalogue();
    // An empty live response is suspicious — keep last good cache if we have it.
    if (provider.source === "live" && ipos.length === 0 && cache) {
      return cache.result;
    }
    const result: CatalogueResult = { ipos, source: provider.source };
    cache = { at: Date.now(), result };
    return result;
  } catch (err) {
    console.error("[calendar] live provider failed, falling back to seed:", err);
    if (cache) return cache.result; // prefer last good data over sample
    const result: CatalogueResult = {
      ipos: await seedProvider.fetchCatalogue(),
      source: "sample",
    };
    return result;
  }
}
