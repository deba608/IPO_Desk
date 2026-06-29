// src/features/ipo-calendar/lib/providers/ipoguru.provider.ts
// Live provider backed by the IPO Guru developer API (free, JSON).
//   Docs: https://www.ipoguru.in/ipo-gmp-details-developer-api
//   Auth: X-API-KEY header. Get a free key by emailing the address in the docs
//         and set IPOGURU_API_KEY in the environment.
//
// All normalization is defensive: upstream field formats (e.g. "₹440 - ₹463",
// "2,100.00 Cr") vary, so every parser falls back safely rather than throwing.

import {
  CalendarIPO,
  IPOBoard,
  PriceBand,
  Subscription,
} from "@/types/calendar.types";
import { RegistrarName } from "@/types/ipo.types";
import { CalendarProvider } from "./types";

const BASE_URL = "https://www.ipoguru.in/api/v1";

interface RawGmp {
  price?: number | string;
  percentage?: number | string;
  updated_at?: string;
}
interface RawSubscription {
  qib?: number | string;
  nii?: number | string;
  retail?: number | string;
  total?: number | string;
  updated_at?: string;
}
interface RawIpo {
  name?: string;
  type?: string; // "mainboard" | "sme"
  status?: string;
  open_date?: string;
  close_date?: string;
  allotment_date?: string;
  listing_date?: string;
  listing_price?: number | string;
  price_band?: string;
  lot_size?: number | string;
  issue_size?: string | number;
  listing_on?: string;
  registrar?: string;
  subscription?: RawSubscription;
  gmp?: RawGmp;
}
interface RawResponse {
  success?: boolean;
  count?: number;
  data?: RawIpo[];
}

/** "₹2,100.00" / "2100 Cr" / 2100 → 2100 (number). NaN-safe → 0. */
function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toOptionalNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = toNumber(v);
  return n === 0 && typeof v !== "number" ? undefined : n;
}

/** "₹440 - ₹463" / "440-463" / "118" → { min, max }. */
function parsePriceBand(raw?: string): PriceBand {
  if (!raw) return { min: 0, max: 0 };
  const nums = raw.match(/[\d.]+/g)?.map(Number).filter((n) => !Number.isNaN(n)) ?? [];
  if (nums.length === 0) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Normalise any sensible date string to ISO yyyy-mm-dd, else undefined. */
function toISODate(raw?: string): string | undefined {
  if (!raw) return undefined;
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function parseBoard(type?: string): IPOBoard {
  return (type ?? "").toLowerCase().includes("sme") ? "sme" : "mainboard";
}

function parseExchanges(listingOn?: string): ("NSE" | "BSE")[] {
  const up = (listingOn ?? "").toUpperCase();
  const out: ("NSE" | "BSE")[] = [];
  if (up.includes("NSE")) out.push("NSE");
  if (up.includes("BSE")) out.push("BSE");
  return out.length ? out : ["NSE", "BSE"];
}

const REGISTRAR_MAP: { match: RegExp; name: RegistrarName }[] = [
  { match: /kfin|karvy/i, name: "kfintech" },
  { match: /bigshare/i, name: "bigshare" },
  { match: /link\s*intime|linkintime/i, name: "linkintime" },
  { match: /mufg|intime/i, name: "mufg" },
];

function parseRegistrar(raw?: string): RegistrarName {
  const hit = REGISTRAR_MAP.find((r) => r.match.test(raw ?? ""));
  return hit?.name ?? "kfintech";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSubscription(raw?: RawSubscription): Subscription | undefined {
  if (!raw) return undefined;
  const sub: Subscription = {
    qib: toOptionalNumber(raw.qib),
    nii: toOptionalNumber(raw.nii),
    retail: toOptionalNumber(raw.retail),
    total: toOptionalNumber(raw.total),
    updatedAt: raw.updated_at,
  };
  const hasData =
    sub.qib !== undefined ||
    sub.nii !== undefined ||
    sub.retail !== undefined ||
    sub.total !== undefined;
  return hasData ? sub : undefined;
}

function normalize(raw: RawIpo): CalendarIPO | null {
  const name = raw.name?.trim();
  const openDate = toISODate(raw.open_date);
  const closeDate = toISODate(raw.close_date);
  if (!name || !openDate || !closeDate) return null; // unusable record

  const board = parseBoard(raw.type);

  return {
    id: `${board}-${slugify(name)}`,
    name,
    board,
    registrar: parseRegistrar(raw.registrar),
    leadManagers: [], // not provided by this API
    issueSizeCr: toNumber(raw.issue_size),
    priceBand: parsePriceBand(raw.price_band),
    lotSize: toNumber(raw.lot_size),
    openDate,
    closeDate,
    allotmentDate: toISODate(raw.allotment_date),
    listingDate: toISODate(raw.listing_date),
    exchanges: parseExchanges(raw.listing_on),
    gmp: toOptionalNumber(raw.gmp?.price),
    gmpUpdatedAt: raw.gmp?.updated_at,
    subscription: normalizeSubscription(raw.subscription),
    listingPrice: toOptionalNumber(raw.listing_price),
  };
}

export function createIpoGuruProvider(apiKey: string): CalendarProvider {
  return {
    source: "live",
    async fetchCatalogue(): Promise<CalendarIPO[]> {
      const res = await fetch(`${BASE_URL}/ipos`, {
        headers: { "X-API-KEY": apiKey, Accept: "application/json" },
        // Caching is handled by the provider registry; always get fresh here.
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`IPO Guru API responded ${res.status}`);
      }
      const json: RawResponse = await res.json();
      const rows = json.data ?? [];
      return rows
        .map(normalize)
        .filter((ipo): ipo is CalendarIPO => ipo !== null);
    },
  };
}
