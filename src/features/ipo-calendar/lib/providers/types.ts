// src/features/ipo-calendar/lib/providers/types.ts
// Provider abstraction for calendar data. The service depends only on this
// interface, so the source (seed today, IPO Guru / NSE / Prisma later) can be
// swapped without touching the service or UI.

import { CalendarIPO, DataSource } from "@/types/calendar.types";

export interface CalendarProvider {
  readonly source: DataSource;
  /** Returns the full IPO catalogue; lifecycle/derived fields are added later. */
  fetchCatalogue(): Promise<CalendarIPO[]>;
}
