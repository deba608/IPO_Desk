// src/features/ipo-calendar/lib/calendar-sort.ts
// Sort options for the calendar grid. The "smart" default preserves the
// service's lifecycle-aware ordering; the rest are explicit user choices.

import { CalendarIPOWithStatus } from "@/types/calendar.types";

export type SortKey =
  | "smart"
  | "gmp"
  | "subscription"
  | "issueSize"
  | "closing"
  | "listing";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "smart", label: "Smart" },
  { key: "gmp", label: "GMP (high → low)" },
  { key: "subscription", label: "Subscribed (high → low)" },
  { key: "issueSize", label: "Issue size (high → low)" },
  { key: "closing", label: "Closing soonest" },
  { key: "listing", label: "Listing soonest" },
];

/** Push undefined/zero metrics to the bottom regardless of sort direction. */
function desc(a: number | undefined, b: number | undefined): number {
  const av = a ?? -Infinity;
  const bv = b ?? -Infinity;
  return bv - av;
}

/**
 * Returns a NEW sorted array; never mutates the input. `smart` returns a copy
 * in the original (already lifecycle-sorted) order.
 */
export function sortCalendar(
  ipos: CalendarIPOWithStatus[],
  key: SortKey
): CalendarIPOWithStatus[] {
  const list = [...ipos];
  switch (key) {
    case "gmp":
      return list.sort((a, b) => desc(a.gmpPercent ?? a.gmp, b.gmpPercent ?? b.gmp));
    case "subscription":
      return list.sort((a, b) => desc(a.subscription?.total, b.subscription?.total));
    case "issueSize":
      return list.sort((a, b) => desc(a.issueSizeCr, b.issueSizeCr));
    case "closing":
      return list.sort((a, b) => a.closeDate.localeCompare(b.closeDate));
    case "listing":
      return list.sort((a, b) =>
        (a.listingDate ?? "9999").localeCompare(b.listingDate ?? "9999")
      );
    case "smart":
    default:
      return list;
  }
}
