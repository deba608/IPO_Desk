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

const IG_HEADERS = {
  "User-Agent": UA,
  Accept: "application/json",
  Referer: REFERER,
};

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
  msg?: string | number;
  error?: string;
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
  msg?: string | number;
  error?: string;
  reportTableData?: SubRow[];
}

/**
 * Report data-read path prefixes, newest first. InvestorGain versions this
 * path (it moved `/cloud/report/…` → `/cloud/v2/report/…` in Jul 2026, which
 * silently zeroed our catalogue). We try each in order and use the first that
 * returns a valid table, so a future bump only needs a new entry here.
 */
const REPORT_PATH_PREFIXES = [
  "/cloud/v2/report/data-read",
  "/cloud/report/data-read",
];

// Report ids on InvestorGain.
const REPORT_GMP = 331; // "Live IPO GMP" — GMP, price band, dates, rating
const REPORT_SUBSCRIPTION = 333; // category-wise subscription multiples

/**
 * Calendar year + Indian fiscal year for "today" in IST (FY runs Apr→Mar).
 * Derived from the IST wall clock, not server-local time — a UTC host would
 * otherwise request the wrong year around midnight IST boundaries.
 */
function fyParts(): { cy: number; fy: string } {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const cy = ist.getUTCFullYear();
  const month = ist.getUTCMonth() + 1; // 1-12
  const fyStart = month >= 4 ? cy : cy - 1;
  const fy = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
  return { cy, fy };
}

/** Build a report URL for a given path prefix + report id, scoped to "today". */
function reportUrlFor(prefix: string, reportId: number): string {
  const { cy, fy } = fyParts();
  return `${HOST}${prefix}/${reportId}/1/5/${cy}/${fy}/0/all`;
}

/**
 * Fetch a versioned InvestorGain report, trying each path prefix until one
 * returns a real `reportTableData` array. Throws (with the last error seen) if
 * every candidate fails, so the caller can fall through to another provider
 * instead of silently serving an empty catalogue.
 */
async function fetchReport<T extends { reportTableData?: unknown[] }>(
  reportId: number
): Promise<T> {
  let lastError = "no candidate paths";
  for (let i = 0; i < REPORT_PATH_PREFIXES.length; i++) {
    const prefix = REPORT_PATH_PREFIXES[i];
    try {
      const res = await fetch(reportUrlFor(prefix, reportId), {
        headers: IG_HEADERS,
        cache: "no-store",
      });
      if (!res.ok) {
        lastError = `${prefix} → HTTP ${res.status}`;
        continue;
      }
      const json = (await res.json()) as T & { msg?: unknown; error?: unknown };
      if (Array.isArray(json.reportTableData)) {
        // Falling past the preferred prefix means IG changed its path again —
        // surface it so we notice before the fallback also breaks.
        if (i > 0) {
          console.warn(
            `[investorgain] report ${reportId}: primary path failed (${lastError}), using fallback "${prefix}"`
          );
        }
        return json;
      }
      lastError = `${prefix} → ${String(json.error ?? json.msg ?? "no table")}`;
    } catch (err) {
      lastError = `${prefix} → ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  throw new Error(
    `InvestorGain report ${reportId} unavailable on all paths (${lastError})`
  );
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

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * "Updated-On" display text like "30-Jun 5:55" → real ISO timestamp in IST
 * (+05:30). The report omits the year, so use the current IST year and roll
 * back one year if that would put the update in the future (Dec/Jan boundary).
 */
function parseUpdatedOn(raw?: string): string | undefined {
  const text = stripTags(raw);
  const m = text.match(/(\d{1,2})-([A-Za-z]{3})\s+(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  const [, dd, mon, hh, mi] = m;
  const month = MONTHS[mon.toLowerCase()];
  if (!month) return undefined;

  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000); // wall clock in IST
  let year = nowIST.getUTCFullYear();
  const build = (y: number) =>
    `${y}-${String(month).padStart(2, "0")}-${String(Number(dd)).padStart(2, "0")}` +
    `T${String(Number(hh)).padStart(2, "0")}:${mi}:00+05:30`;
  // An "update" can't be in the future — if it is, it belongs to last year.
  if (new Date(build(year)).getTime() > Date.now() + 60_000) year -= 1;
  const iso = build(year);
  return Number.isNaN(new Date(iso).getTime()) ? undefined : iso;
}

/** "Rs 28 (28.28%) ..." → 28. "Rs -- (0.00%)" / "" → undefined. */
function parseGmp(raw?: string): number | undefined {
  const text = stripTags(raw);
  const m = text.match(/-?\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

/**
 * Intraday GMP band from the "<small><b>75 ↓ / 140 ↑</b></small>" fragment that
 * follows the headline GMP — the seller (↓) and buyer (↑) grey-market rates.
 * Returns undefined when the fragment is absent or unparseable.
 */
function parseGmpRange(raw?: string): { min?: number; max?: number } {
  if (!raw) return {};
  const m = raw.match(
    /<small[^>]*>[\s\S]*?(-?\d+(?:\.\d+)?)\s*↓\s*\/\s*(-?\d+(?:\.\d+)?)\s*↑/
  );
  if (!m) return {};
  const min = Number(m[1]);
  const max = Number(m[2]);
  return {
    min: Number.isFinite(min) ? min : undefined,
    max: Number.isFinite(max) ? max : undefined,
  };
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
  const gmpRange = parseGmpRange(row.GMP);

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
    gmpMin: gmpRange.min,
    gmpMax: gmpRange.max,
    gmpUpdatedAt: parseUpdatedOn(row["Updated-On"]),
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

/** Raw row of the `gmpData` array embedded in an InvestorGain detail page. */
interface RawGmpHistoryRow {
  gmp_date?: string; // "06-07-2026" (dd-mm-yyyy)
  gmp?: string; // "8" | "" | "--"
  gmp_percent_calc?: string; // "13.33"
  estimated_listing_price?: string;
  create_date?: string; // full ISO timestamp
}

/** "06-07-2026" (dd-mm-yyyy) → "2026-07-06". */
function ddmmyyyyToISO(s?: string): string | undefined {
  const m = (s ?? "").trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

/**
 * Date-wise GMP history for one IPO, scraped from the server-rendered
 * `gmpData` array on its InvestorGain detail page (no JSON endpoint exists).
 * Returns entries sorted oldest→newest, deduped by date. Throws on fetch
 * failure so callers can decide their own fallback.
 */
/**
 * Fetches an IG detail page and returns its HTML with flight-payload quote
 * escaping undone. Same URL+options everywhere, so Next's data cache dedupes
 * concurrent band/history reads of the same page.
 */
async function fetchDetailHtml(sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    // Detail pages are heavy (~130KB); let Next cache them briefly.
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`InvestorGain detail page responded ${res.status}`);
  return (await res.text()).replace(/\\"/g, '"');
}

/**
 * Real price band from the detail page (`issue_price_lower/upper`). The list
 * report only carries the cap price, so book-built bands (e.g. ₹398–419) come
 * out flat there. Returns undefined when the page doesn't expose both bounds.
 */
export async function fetchLivePriceBand(
  sourceUrl: string
): Promise<PriceBand | undefined> {
  const html = await fetchDetailHtml(sourceUrl);
  const lo = Number(html.match(/"issue_price_lower":"?([\d.]+)/)?.[1]);
  const hi = Number(html.match(/"issue_price_upper":"?([\d.]+)/)?.[1]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi <= 0) {
    return undefined;
  }
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
}

export async function fetchGmpHistory(
  sourceUrl: string
): Promise<import("@/types/calendar.types").GMPEntry[]> {
  // The array lives inside a Next.js flight payload with escaped quotes.
  const html = await fetchDetailHtml(sourceUrl);
  const start = html.indexOf('"gmpData":[');
  if (start === -1) return [];

  // Balanced-bracket scan from the opening `[` — the payload after the array
  // is arbitrary, so a regex can't safely find the end.
  const open = html.indexOf("[", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < html.length; i++) {
    const ch = html[i];
    if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end === -1) return [];

  let rows: RawGmpHistoryRow[];
  try {
    rows = JSON.parse(html.slice(open, end + 1));
  } catch {
    return [];
  }

  const byDate = new Map<string, { gmp: number; gainPercent?: number }>();
  for (const row of rows) {
    const date = ddmmyyyyToISO(row.gmp_date);
    const gmp = Number(row.gmp);
    if (!date || !Number.isFinite(gmp)) continue;
    const pct = Number(row.gmp_percent_calc);
    // Rows arrive newest-first; keep the first (latest) record per date.
    if (!byDate.has(date)) {
      byDate.set(date, {
        gmp,
        gainPercent: Number.isFinite(pct) ? pct : undefined,
      });
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, gmp: v.gmp, gainPercent: v.gainPercent }));
}

export function createInvestorGainProvider(): CalendarProvider {
  return {
    source: "live",
    credit: { name: "InvestorGain", url: "https://www.investorgain.com/" },
    async fetchCatalogue(): Promise<CalendarIPO[]> {
      // Primary report (331) is required — fetchReport throws if every path
      // candidate fails, so loadCatalogue falls through to NSE. The
      // subscription report (333) is best-effort enrichment.
      const [gmpResult, subResult] = await Promise.allSettled([
        fetchReport<RawResponse>(REPORT_GMP),
        fetchReport<SubResponse>(REPORT_SUBSCRIPTION),
      ]);

      if (gmpResult.status !== "fulfilled") {
        throw gmpResult.reason instanceof Error
          ? gmpResult.reason
          : new Error(String(gmpResult.reason));
      }

      const subMap =
        subResult.status === "fulfilled"
          ? buildSubMap(subResult.value.reportTableData ?? [])
          : undefined;

      const rows = gmpResult.value.reportTableData ?? [];
      const catalogue = rows
        .map((row) => normalize(row, subMap))
        .filter((ipo): ipo is CalendarIPO => ipo !== null);

      // Rows that lack confirmed open/close dates can't be placed on a
      // date-based calendar, so normalize() drops them. Log the names once so
      // pre-announcement IPOs missing from the calendar are explainable.
      const dropped = rows.length - catalogue.length;
      if (dropped > 0) {
        const names = rows
          .filter((r) => !isoDate(r["~Srt_Open"]) || !isoDate(r["~Srt_Close"]))
          .map((r) => (r["~ipo_name"] ?? "").trim())
          .filter(Boolean);
        console.info(
          `[investorgain] ${dropped} IPO(s) without confirmed dates skipped: ${names.join(", ")}`
        );
      }
      return catalogue;
    },
  };
}
