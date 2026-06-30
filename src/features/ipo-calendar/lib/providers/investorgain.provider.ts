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
  Rating?: string; // "🔥🔥🔥" (HTML entities) — count = crowd rating 1–5
  Anchor?: string; // "✅" / "❌" — anchor allotment announced
  "Price (₹)"?: string;
  "IPO Size"?: string;
  Lot?: string;
  "Updated-On"?: string;
  "~P/E"?: string; // "18.33" | "--"
  "~gmp_percent_calc"?: string; // authoritative GMP % e.g. "28.28"
  "~urlrewrite_folder_name"?: string; // "/gmp/<slug>/<id>/"
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

/** A row from the subscription report (333): category multiples by IG id. */
interface SubRow {
  Total?: string;
  QIB?: string;
  NII?: string;
  SHNI?: string;
  BHNI?: string;
  RII?: string;
  "~id"?: number;
}
interface SubResponse {
  reportTableData?: SubRow[];
}

/** Calendar year + Indian fiscal year for "today" (FY runs Apr→Mar). */
function fyParts(): { cy: number; fy: string } {
  const now = new Date();
  const cy = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const fyStart = month >= 4 ? cy : cy - 1;
  const fy = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
  return { cy, fy };
}

/** Report 331 = "Live IPO GMP" (GMP, price band, dates, rating). */
function reportUrl(): string {
  const { cy, fy } = fyParts();
  return `${HOST}/cloud/report/data-read/331/1/5/${cy}/${fy}/0/all`;
}

/** Report 333 = "IPO Subscription" (category-wise multiples while open). */
function subscriptionUrl(): string {
  const { cy, fy } = fyParts();
  return `${HOST}/cloud/report/data-read/333/1/5/${cy}/${fy}/0/all`;
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

/** Crowd rating = count of 🔥 (entity &#128293; or literal) in the Rating cell, capped 1–5. */
function parseRating(raw?: string): number | undefined {
  if (!raw) return undefined;
  const fires = (raw.match(/128293|🔥/g) ?? []).length;
  return fires > 0 ? Math.min(fires, 5) : undefined;
}

/** Plain decimal from a "~P/E"-style field; "--" / "" → undefined. */
function parseDecimal(raw?: string): number | undefined {
  const m = stripTags(raw).match(/-?\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

/** Anchor column carries a ✅ when the anchor allotment is announced. */
function parseAnchor(raw?: string): boolean | undefined {
  if (raw === undefined) return undefined;
  if (raw.includes("✅")) return true;
  if (raw.includes("❌")) return false;
  return undefined;
}

/** Positive subscription multiple, else undefined ("-" / 0). */
function subValue(raw?: string): number | undefined {
  const n = parseDecimal(raw);
  return n !== undefined && n > 0 ? n : undefined;
}

/** Build a map of IG id → category subscription from the subscription report. */
function buildSubMap(rows: SubRow[]): Map<number, import("@/types/calendar.types").Subscription> {
  const map = new Map<number, import("@/types/calendar.types").Subscription>();
  const now = new Date().toISOString();
  for (const r of rows) {
    if (typeof r["~id"] !== "number") continue;
    const sub = {
      total: subValue(r.Total),
      qib: subValue(r.QIB),
      nii: subValue(r.NII),
      shni: subValue(r.SHNI),
      bhni: subValue(r.BHNI),
      retail: subValue(r.RII),
      updatedAt: now,
    };
    // Skip rows with no usable numbers at all.
    if (Object.values(sub).some((v) => typeof v === "number")) {
      map.set(r["~id"], sub);
    }
  }
  return map;
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

function normalize(
  row: RawRow,
  subMap?: Map<number, import("@/types/calendar.types").Subscription>
): CalendarIPO | null {
  const name = (row["~ipo_name"] ?? stripTags(row.Name)).trim();
  const openDate = isoDate(row["~Srt_Open"]);
  const closeDate = isoDate(row["~Srt_Close"]);
  if (!name || !openDate || !closeDate) return null; // unusable record

  const board = parseBoard(row["~IPO_Category"]);
  const igId = typeof row["~id"] === "number" ? row["~id"] : undefined;

  // Prefer the richer category breakdown from the subscription report (333);
  // fall back to the single "Sub" total carried in the GMP report (331).
  const categorySub = igId !== undefined ? subMap?.get(igId) : undefined;
  const totalSub = parseSub(row.Sub);
  const subscription =
    categorySub ??
    (totalSub !== undefined
      ? { total: totalSub, updatedAt: new Date().toISOString() }
      : undefined);

  const sourcePath = row["~urlrewrite_folder_name"]?.trim();

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
    gmpPercent: parseDecimal(row["~gmp_percent_calc"]) || undefined,
    subscription,
    listingPrice: undefined,
    rating: parseRating(row.Rating),
    peRatio: parseDecimal(row["~P/E"]),
    anchorListed: parseAnchor(row.Anchor),
    igId,
    sourceUrl: sourcePath ? `https://www.investorgain.com${sourcePath}` : undefined,
  };
}

const IG_HEADERS = {
  "User-Agent": UA,
  Accept: "application/json",
  Referer: REFERER,
};

export function createInvestorGainProvider(): CalendarProvider {
  return {
    source: "live",
    async fetchCatalogue(): Promise<CalendarIPO[]> {
      // Primary report (331) is required; the subscription report (333) is a
      // best-effort enrichment — a failure there must not sink the catalogue.
      const [gmpRes, subRes] = await Promise.allSettled([
        fetch(reportUrl(), { headers: IG_HEADERS, cache: "no-store" }),
        fetch(subscriptionUrl(), { headers: IG_HEADERS, cache: "no-store" }),
      ]);

      if (gmpRes.status !== "fulfilled" || !gmpRes.value.ok) {
        const code =
          gmpRes.status === "fulfilled" ? gmpRes.value.status : "network error";
        throw new Error(`InvestorGain report responded ${code}`);
      }

      let subMap: Map<number, import("@/types/calendar.types").Subscription> | undefined;
      if (subRes.status === "fulfilled" && subRes.value.ok) {
        try {
          const subJson: SubResponse = await subRes.value.json();
          subMap = buildSubMap(subJson.reportTableData ?? []);
        } catch {
          // Malformed subscription payload — proceed without category breakdown.
        }
      }

      const json: RawResponse = await gmpRes.value.json();
      const rows = json.reportTableData ?? [];
      return rows
        .map((row) => normalize(row, subMap))
        .filter((ipo): ipo is CalendarIPO => ipo !== null);
    },
  };
}
