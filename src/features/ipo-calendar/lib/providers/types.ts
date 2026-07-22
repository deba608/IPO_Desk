// src/features/ipo-calendar/lib/providers/types.ts
// Provider abstraction for calendar data. The service depends only on this
// interface, so the source (seed today, IPO Guru / NSE / Prisma later) can be
// swapped without touching the service or UI.

import { CalendarIPO, DataSource, ProviderCredit } from "@/types/calendar.types";

export interface CalendarProvider {
  readonly source: DataSource;
  /** Attribution shown in the UI when this provider serves the data. */
  readonly credit: ProviderCredit;
  /** Returns the full IPO catalogue; lifecycle/derived fields are added later. */
  fetchCatalogue(): Promise<CalendarIPO[]>;
}
