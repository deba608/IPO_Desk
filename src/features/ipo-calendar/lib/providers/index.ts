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
import { createInvestorGainProvider } from "./investorgain.provider";

export interface CatalogueResult {
  ipos: CalendarIPO[];
  source: DataSource;
}

const TTL_MS = 60 * 1000; // 1 minute — matches client polling interval

let cache: { at: number; result: CatalogueResult } | null = null;

// Live-source priority (first that succeeds wins):
//   1. IPO Guru     — when IPOGURU_API_KEY is set (official partner feed)
//   2. InvestorGain — keyless, richest free source (GMP + dates + lot + size)
//   3. NSE official — keyless fallback (no GMP)
// Seed sample data is only reached if every live source fails.
function liveProviders(): CalendarProvider[] {
  const key = process.env.IPOGURU_API_KEY?.trim();
  const chain: CalendarProvider[] = [];
  if (key) chain.push(createIpoGuruProvider(key));
  chain.push(createInvestorGainProvider());
  chain.push(createNseProvider());
  return chain;
}

/** Returns the IPO catalogue + its source, cached for TTL_MS. */
export async function loadCatalogue(forceRefresh = false): Promise<CatalogueResult> {
  if (!forceRefresh && cache && Date.now() - cache.at < TTL_MS) {
    return cache.result;
  }

  // Try each live source in priority order; first non-empty result wins.
  for (const provider of liveProviders()) {
    try {
      const ipos = await provider.fetchCatalogue();
      if (ipos.length === 0) continue; // empty → try the next source
      const result: CatalogueResult = { ipos, source: provider.source };
      cache = { at: Date.now(), result };
      return result;
    } catch (err) {
      console.error("[calendar] live provider failed, trying next source:", err);
    }
  }

  // Every live source failed/empty: prefer last good cache, else sample seed.
  if (cache) return cache.result;
  return { ipos: await seedProvider.fetchCatalogue(), source: "sample" };
}
