// src/features/ipo-calendar/lib/providers/investorgain.provider.ts
// Live provider backed by InvestorGain's public "Live IPO GMP" report JSON.
// No API key, no cookie priming required — just a browser UA + Referer.
//
// This is the richest keyless source: it carries GMP (grey-market premium),
// price band, lot size, issue size (in crore), open/close/allotment/listing
// dates, and category (mainboard vs SME). Subscription is only populated while
// an issue is open. The registrar is NOT in this report, so it defaults.
//
// Endpoint (report id 331 = "Live IPO GMP"):
//   GET https://webnodejs.investorgain.com/cloud/report/data-read/331/1/5/<CY>/<FY>/0/all
//   <CY> = calendar year (e.g. 2026), <FY> = Indian fiscal year (e.g. 2026-27).
// Both are derived from "today" so the URL never goes stale.
//
// Field values are HTML fragments (anchor tags, badges, ₹ entities); every
// parser strips tags first and falls back safely. The `~Srt_*` columns already
// hold clean yyyy-mm-dd dates, so we prefer those over the display columns.

import { CalendarIPO, IPOBoard, PriceBand } from "@/types/calendar.types";
import { CalendarProvider } from "./types";

const HOST = "https://webnodejs.investorgain.com";
const REFERER = "https://www.investorgain.com/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface RawRow {
  Name?: string;
  GMP?: string;
  Sub?: string;
  "Price (₹)"?: string;
  "IPO Size"?: string;
  Lot?: string;
  "Updated-On"?: string;
  "~id"?: number;
  "~IPO_Category"?: string; // "IPO" (mainboard) | "SME"
  "~ipo_name"?: string;
  "~Srt_Open"?: string; // yyyy-mm-dd
  "~Srt_Close"?: string;
  "~Srt_BoA_Dt"?: string; // allotment
  "~Str_Listing"?: string;
}

interface RawResponse {
  reportTableData?: RawRow[];
}

/** Build the report URL for "today": calendar year + Indian fiscal year. */
function reportUrl(): string {
  const now = new Date();
  const cy = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  // Indian FY runs Apr→Mar. Apr-Dec → cy-(cy+1); Jan-Mar → (cy-1)-cy.
  const fyStart = month >= 4 ? cy : cy - 1;
  const fy = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
  return `${HOST}/cloud/report/data-read/331/1/5/${cy}/${fy}/0/all`;
}

function stripTags(s?: string): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8377;/g, "")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(s?: string): string | undefined {
  if (!s) return undefined;
  const m = s.trim().match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : undefined;
}

/** "Rs 28 (28.28%) ..." → 28. "Rs -- (0.00%)" / "" → undefined. */
function parseGmp(raw?: string): number | undefined {
  const text = stripTags(raw);
  const m = text.match(/-?\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

/** "170" / "99 - 100" → { min, max }. */
function parsePriceBand(raw?: string): PriceBand {
  const nums =
    stripTags(raw).match(/\d+(?:\.\d+)?/g)?.map(Number).filter((n) => !Number.isNaN(n)) ?? [];
  if (nums.length === 0) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** "Rs47.91 Cr" → 47.91; "-" → 0. */
function parseCrore(raw?: string): number {
  const m = stripTags(raw).match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

function parseNumber(raw?: string): number {
  const m = stripTags(raw).match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

/** Subscription total in × from the "Sub" column; "-" → undefined. */
function parseSub(raw?: string): number | undefined {
  const m = stripTags(raw).match(/\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseBoard(category?: string): IPOBoard {
  return (category ?? "").toUpperCase() === "SME" ? "sme" : "mainboard";
}

/** Exchanges from the "NSE SME" / "BSE SME" / "NSE" badge in the Name cell. */
function parseExchanges(nameHtml?: string): ("NSE" | "BSE")[] {
  const up = (nameHtml ?? "").toUpperCase();
  const out: ("NSE" | "BSE")[] = [];
  if (up.includes("NSE")) out.push("NSE");
  if (up.includes("BSE")) out.push("BSE");
  return out.length ? out : ["NSE", "BSE"];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalize(row: RawRow): CalendarIPO | null {
  const name = (row["~ipo_name"] ?? stripTags(row.Name)).trim();
  const openDate = isoDate(row["~Srt_Open"]);
  const closeDate = isoDate(row["~Srt_Close"]);
  if (!name || !openDate || !closeDate) return null; // unusable record

  const board = parseBoard(row["~IPO_Category"]);
  const sub = parseSub(row.Sub);

  return {
    id: `${board}-${slugify(name)}`,
    name,
    board,
    registrar: "kfintech", // not in this report; display-only default
    leadManagers: [],
    issueSizeCr: parseCrore(row["IPO Size"]),
    priceBand: parsePriceBand(row["Price (₹)"]),
    lotSize: parseNumber(row.Lot),
    openDate,
    closeDate,
    allotmentDate: isoDate(row["~Srt_BoA_Dt"]),
    listingDate: isoDate(row["~Str_Listing"]),
    exchanges: parseExchanges(row.Name),
    gmp: parseGmp(row.GMP),
    gmpUpdatedAt: stripTags(row["Updated-On"]) || undefined,
    subscription: sub !== undefined ? { total: sub, updatedAt: new Date().toISOString() } : undefined,
    listingPrice: undefined,
  };
}

export function createInvestorGainProvider(): CalendarProvider {
  return {
    source: "live",
    async fetchCatalogue(): Promise<CalendarIPO[]> {
      const res = await fetch(reportUrl(), {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          Referer: REFERER,
        },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`InvestorGain report responded ${res.status}`);
      }
      const json: RawResponse = await res.json();
      const rows = json.reportTableData ?? [];
      return rows
        .map(normalize)
        .filter((ipo): ipo is CalendarIPO => ipo !== null);
    },
  };
}
