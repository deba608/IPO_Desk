// src/types/calendar.types.ts
// Calendar/listing domain types. Kept separate from the live allotment-checker
// IPO type (ipo.types.ts) because the calendar carries full issue metadata that
// registrars do not expose. This shape maps 1:1 to a future Prisma `Ipo` model.

import { RegistrarName } from "./ipo.types";

export type IPOBoard = "mainboard" | "sme";

/**
 * Lifecycle status, derived from the issue dates relative to "today".
 * Not stored — computed in the service so it is always current.
 */
export type IPOLifecycle = "upcoming" | "open" | "closed" | "listed";

export interface PriceBand {
  /** Lower bound of the price band, in INR per share */
  min: number;
  /** Upper bound of the price band, in INR per share */
  max: number;
}

/** Subscription multiples by investor category (×), as published by NSE/BSE. */
export interface Subscription {
  qib?: number;
  nii?: number;
  retail?: number;
  total?: number;
  /** ISO timestamp of the last subscription update */
  updatedAt?: string;
}

/** Where the calendar data came from — surfaced in the UI for honesty. */
export type DataSource = "live" | "sample";

export interface CalendarIPO {
  /** Stable identifier, e.g. `mainboard-acme-2026` */
  id: string;
  name: string;
  /** Short company/ticker symbol, when known */
  symbol?: string;
  board: IPOBoard;
  registrar: RegistrarName;
  leadManagers: string[];

  /** Total issue size in INR crore */
  issueSizeCr: number;
  priceBand: PriceBand;
  /** Shares per application lot (retail minimum) */
  lotSize: number;

  /** ISO date (yyyy-mm-dd) the issue opens for subscription */
  openDate: string;
  /** ISO date the issue closes */
  closeDate: string;
  /** ISO date the registrar finalises allotment, when known */
  allotmentDate?: string;
  /** ISO date of listing on the exchange, when scheduled/known */
  listingDate?: string;

  /** Exchange(s) the issue lists on */
  exchanges: ("NSE" | "BSE")[];

  /** Latest grey-market premium in INR, when available */
  gmp?: number;
  /** ISO timestamp of the last GMP update */
  gmpUpdatedAt?: string;
  /** Historical GMP snapshots for trend chart (most recent first) */
  gmpHistory?: GMPEntry[];
  /** Live subscription multiples by category, when available */
  subscription?: Subscription;
  /** Issue price used for listing-day returns, once listed (INR) */
  listingPrice?: number;
}

export interface CalendarIPOWithStatus extends CalendarIPO {
  lifecycle: IPOLifecycle;
  /** Retail minimum investment at cut-off price = lotSize * priceBand.max */
  minInvestment: number;
  /** GMP as % of upper price band, when GMP is known */
  gmpPercent?: number;
  /** Listing gain % vs upper price band, once listed */
  listingGainPercent?: number;
}

/** A single GMP data point for trend charts */
export interface GMPEntry {
  /** ISO date (yyyy-mm-dd) of the snapshot */
  date: string;
  /** GMP value in INR */
  gmp: number;
  /** Estimated gain % (gmp / upper price band * 100), when price band is known */
  gainPercent?: number;
}

export interface CalendarResponse {
  ipos: CalendarIPOWithStatus[];
  total: number;
  counts: Record<IPOLifecycle, number>;
  /** "live" when served from a real provider, "sample" for seed data */
  dataSource: DataSource;
  lastUpdated: string;
}
