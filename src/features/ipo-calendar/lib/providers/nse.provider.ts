// src/features/ipo-calendar/lib/providers/nse.provider.ts
// Live provider backed by NSE India's public IPO JSON endpoints. No API key
// required, but NSE rejects requests without a primed session cookie, so every
// catalogue fetch first hits the homepage to obtain cookies, then calls the API
// with them + a browser-like User-Agent and Referer.
//
// What NSE provides (official): company name, symbol, open/close dates, price
// band, issue size (in shares), live subscription. What it does NOT provide and
// is therefore left blank/derived: GMP (grey-market, unofficial), lot size,
// allotment date, listing date, registrar, lead managers. issueSizeCr is
// ESTIMATED from shares × upper price band.
//
// Endpoints:
//   GET /api/all-upcoming-issues?category=ipo  → mainboard upcoming + active
//   GET /api/all-upcoming-issues?category=sme  → SME upcoming + active
//   GET /api/ipo-current-issue                 → active issues w/ subscription
// Empty results come back as `{}` (object), not `[]`, so all parsing is
// Array.isArray-guarded.

import {
  CalendarIPO,
  IPOBoard,
  PriceBand,
  Subscription,
} from "@/types/calendar.types";
import { CalendarProvider } from "./types";
import { fetchWithTimeout } from "./fetch-utils";

const ORIGIN = "https://www.nseindia.com";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface RawUpcoming {
  companyName?: string;
  symbol?: string;
  series?: string;
  status?: string;
  issuePrice?: string; // "Rs.125 to Rs.136 "
  issueSize?: string; // shares, e.g. "13600000"
  issueStartDate?: string; // "29-Jun-2026"
  issueEndDate?: string; // "01-Jul-2026"
}

interface RawCurrent extends RawUpcoming {
  category?: string; // "Total", "Qualified Institutional Buyers(QIBs)", ...
  noOfTime?: string; // subscription multiple as string
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "29-Jun-2026" → "2026-06-29"; ISO passthrough; else undefined. */
function toISODate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const mm = MONTHS[m[2].toLowerCase()];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
  }
  return undefined;
}

/** "Rs.125 to Rs.136 " / "118" → { min, max }. The `\d+(?:\.\d+)?` pattern
 * avoids capturing the dot in the "Rs." prefix as a leading decimal. */
function parsePriceBand(raw?: string): PriceBand {
  const nums =
    raw?.match(/\d+(?:\.\d+)?/g)?.map(Number).filter((n) => !Number.isNaN(n)) ??
    [];
  if (nums.length === 0) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function asArray<T>(json: unknown): T[] {
  return Array.isArray(json) ? (json as T[]) : [];
}

function normalize(raw: RawUpcoming, board: IPOBoard): CalendarIPO | null {
  const name = raw.companyName?.trim();
  const openDate = toISODate(raw.issueStartDate);
  const closeDate = toISODate(raw.issueEndDate);
  if (!name || !openDate || !closeDate) return null; // unusable record

  const priceBand = parsePriceBand(raw.issuePrice);
  const shares = toNumber(raw.issueSize);
  // Estimate issue size in crore = shares × cut-off price / 1e7. Approximate;
  // NSE does not publish the rupee issue size directly.
  const issueSizeCr =
    shares > 0 && priceBand.max > 0
      ? Math.round(((shares * priceBand.max) / 1e7) * 10) / 10
      : 0;

  return {
    // Year-suffixed so a same-name relist in another year can't collide with
    // (and overwrite) the earlier record.
    id: `${board}-${slugify(name)}-${openDate.slice(0, 4)}`,
    name,
    symbol: raw.symbol?.trim() || undefined,
    board,
    registrar: "kfintech", // NSE does not expose the registrar; sensible default
    leadManagers: [],
    issueSizeCr,
    priceBand,
    lotSize: 0, // not provided by NSE
    openDate,
    closeDate,
    allotmentDate: undefined,
    listingDate: undefined,
    exchanges: ["NSE", "BSE"],
    gmp: undefined, // grey-market premium has no official source
    subscription: undefined,
    listingPrice: undefined,
  };
}

export function createNseProvider(): CalendarProvider {
  return {
    source: "live",
    credit: { name: "NSE", url: "https://www.nseindia.com/" },
    async fetchCatalogue(): Promise<CalendarIPO[]> {
      // 1. Prime session cookies from the homepage.
      const home = await fetchWithTimeout(ORIGIN, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        cache: "no-store",
      });
      const setCookie =
        typeof home.headers.getSetCookie === "function"
          ? home.headers.getSetCookie()
          : home.headers.get("set-cookie")
          ? [home.headers.get("set-cookie") as string]
          : [];
      const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");

      const apiHeaders = {
        "User-Agent": UA,
        Accept: "application/json",
        Referer: `${ORIGIN}/market-data/all-upcoming-issues-ipo`,
        Cookie: cookie,
      };

      const getJson = async (path: string): Promise<unknown> => {
        const res = await fetchWithTimeout(`${ORIGIN}${path}`, {
          headers: apiHeaders,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`NSE ${path} responded ${res.status}`);
        return res.json();
      };

      // 2. Fetch mainboard + SME catalogues and live subscription in parallel.
      const [mainboard, sme, current] = await Promise.all([
        getJson("/api/all-upcoming-issues?category=ipo"),
        getJson("/api/all-upcoming-issues?category=sme"),
        getJson("/api/ipo-current-issue").catch((err) => {
          // Optional enrichment — degrade to no subscription data, but log it
          // so a persistent outage isn't invisible.
          console.warn("[nse] current-issue subscription fetch failed:", err);
          return [];
        }),
      ]);

      const ipos = [
        ...asArray<RawUpcoming>(mainboard).map((r) => normalize(r, "mainboard")),
        ...asArray<RawUpcoming>(sme).map((r) => normalize(r, "sme")),
      ].filter((ipo): ipo is CalendarIPO => ipo !== null);

      // 3. Attach total subscription (×) from the current-issue feed by symbol.
      const subBySymbol = new Map<string, Subscription>();
      for (const row of asArray<RawCurrent>(current)) {
        const sym = row.symbol?.trim();
        if (!sym) continue;
        const isTotal = (row.category ?? "Total").toLowerCase() === "total";
        const times = toNumber(row.noOfTime);
        if (isTotal && times > 0) {
          subBySymbol.set(sym, {
            total: Math.round(times * 100) / 100,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      for (const ipo of ipos) {
        if (ipo.symbol && subBySymbol.has(ipo.symbol)) {
          ipo.subscription = subBySymbol.get(ipo.symbol);
        }
      }

      return ipos;
    },
  };
}
