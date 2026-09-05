// src/features/ipo-calendar/lib/calendar.service.ts
// Read model for the IPO Calendar. Reads the seed catalogue, derives lifecycle
// status and computed fields, and returns a stable, sorted view. The data
// source is intentionally behind `loadCatalogue()` so it can later become a
// Prisma query without touching callers.

import {
  CalendarIPO,
  CalendarIPOWithStatus,
  CalendarResponse,
  IPOLifecycle,
} from "@/types/calendar.types";
import { loadCatalogue } from "./providers";
import { fetchLivePriceBand } from "./providers/investorgain.provider";

/** yyyy-mm-dd in IST, used as the reference "today" for lifecycle derivation. */
export function todayISO(): string {
  // IST is UTC+5:30; format the wall-clock date in that zone.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function deriveLifecycle(ipo: CalendarIPO, today: string): IPOLifecycle {
  if (ipo.listingDate && today >= ipo.listingDate) return "listed";
  if (today < ipo.openDate) return "upcoming";
  if (today > ipo.closeDate) return "closed";
  return "open";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function enrich(ipo: CalendarIPO, today: string): CalendarIPOWithStatus {
  const lifecycle = deriveLifecycle(ipo, today);
  const minInvestment = ipo.lotSize * ipo.priceBand.max;

  // Prefer the provider's published GMP % (InvestorGain `~gmp_percent_calc`);
  // fall back to computing it from GMP and the upper price band.
  const gmpPercent =
    ipo.gmpPercent !== undefined
      ? round1(ipo.gmpPercent)
      : ipo.gmp !== undefined && ipo.priceBand.max > 0
      ? round1((ipo.gmp / ipo.priceBand.max) * 100)
      : undefined;

  const listingGainPercent =
    ipo.listingPrice !== undefined && ipo.priceBand.max > 0
      ? round1(((ipo.listingPrice - ipo.priceBand.max) / ipo.priceBand.max) * 100)
      : undefined;

  return { ...ipo, lifecycle, minInvestment, gmpPercent, listingGainPercent };
}

/** Sort key within a lifecycle bucket: nearest relevant date first. */
function compareWithin(a: CalendarIPOWithStatus, b: CalendarIPOWithStatus): number {
  switch (a.lifecycle) {
    case "upcoming":
      return a.openDate.localeCompare(b.openDate); // soonest to open first
    case "open":
      return a.closeDate.localeCompare(b.closeDate); // closing soonest first
    case "closed":
      return (a.listingDate ?? "").localeCompare(b.listingDate ?? ""); // listing soonest first
    case "listed":
      // most recently listed first
      return (b.listingDate ?? "").localeCompare(a.listingDate ?? "");
  }
}

export async function getCalendar(forceRefresh = false): Promise<CalendarResponse> {
  const today = todayISO();
  const { ipos: catalogue, source, credit } = await loadCatalogue(forceRefresh);

  const ipos = catalogue.map((ipo) => enrich(ipo, today)).sort(compareWithin);

  const counts: Record<IPOLifecycle, number> = {
    upcoming: 0,
    open: 0,
    closed: 0,
    listed: 0,
  };
  for (const ipo of ipos) counts[ipo.lifecycle]++;

  return {
    ipos,
    total: ipos.length,
    counts,
    dataSource: source,
    credit,
    lastUpdated: new Date().toISOString(),
  };
}

/** Resolve a single enriched IPO by its calendar id (for the details page). */
export async function findCalendarIPO(
  id: string
): Promise<CalendarIPOWithStatus | undefined> {
  const today = todayISO();
  const { ipos } = await loadCatalogue();
  let match = ipos.find((ipo) => ipo.id === id);
  if (!match) return undefined;

  // The list report only carries the cap price, so a flat band (min === max)
  // is usually a book-built range collapsed to its upper bound. The detail
  // page has the real bounds — enrich from there, best-effort.
  if (
    match.sourceUrl &&
    match.priceBand.max > 0 &&
    match.priceBand.min === match.priceBand.max
  ) {
    try {
      const band = await fetchLivePriceBand(match.sourceUrl);
      if (band) match = { ...match, priceBand: band };
    } catch {
      // Keep the report's cap-only band.
    }
  }

  return enrich(match, today);
}
