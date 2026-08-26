import { NextResponse } from "next/server";
import { findCalendarIPO } from "@/features/ipo-calendar/lib/calendar.service";
import { fetchGmpHistory } from "@/features/ipo-calendar/lib/providers/investorgain.provider";
import { checkDbAvailability, getPrisma } from "@/services/db.service";
import type { GMPEntry } from "@/types/calendar.types";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Per-IPO in-memory cache: IG detail pages are ~130KB HTML, so don't re-scrape
// on every chart render. GMP updates a few times a day; 10 minutes is plenty.
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; history: GMPEntry[] }>();

// Drop long-dead entries so the cache can't grow with the catalogue forever.
function evictStaleCache() {
  for (const [key, entry] of cache) {
    if (Date.now() - entry.at >= TTL_MS) cache.delete(key);
  }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const ipo = await findCalendarIPO(id);
  if (!ipo) {
    return NextResponse.json({ history: [] });
  }

  const capPrice = ipo.priceBand.max;

  // 1) Our own DB snapshots, when a database is configured and has depth.
  if (checkDbAvailability()) {
    try {
      const prisma = await getPrisma();
      const dbIpo = await prisma.ipo.findUnique({ where: { slug: id } });
      if (dbIpo) {
        // Newest snapshots first, then restore chronological order for the chart.
        const snapshots = await prisma.gmpSnapshot.findMany({
          where: { ipoId: dbIpo.id },
          orderBy: { date: "desc" },
          take: 30,
        });
        if (snapshots.length >= 2) {
          const typed = (snapshots as Array<{ date: Date; gmp: number }>).reverse();
          return NextResponse.json({
            history: typed.map((s) => ({
              date: s.date.toISOString().split("T")[0],
              gmp: s.gmp,
              gainPercent:
                capPrice > 0
                  ? Math.round((s.gmp / capPrice) * 1000) / 10
                  : undefined,
            })),
            source: "db",
          });
        }
      }
    } catch {
      // Fall through to the live source below.
    }
  }

  // 2) Live date-wise history from the IPO's InvestorGain detail page.
  if (ipo.sourceUrl) {
    evictStaleCache();
    const cached = cache.get(id);
    if (cached && Date.now() - cached.at < TTL_MS) {
      return NextResponse.json({ history: cached.history, source: "investorgain" });
    }
    try {
      const history = await fetchGmpHistory(ipo.sourceUrl);
      if (history.length > 0) {
        cache.set(id, { at: Date.now(), history });
        return NextResponse.json({ history, source: "investorgain" });
      }
      // Empty result is still a valid answer — serve known-good cache if any.
      if (cached) {
        return NextResponse.json({ history: cached.history, source: "investorgain" });
      }
    } catch (err) {
      console.error(`[gmp-history] live fetch failed for ${id}:`, err);
      // Serve a stale cache over nothing.
      if (cached) {
        return NextResponse.json({ history: cached.history, source: "investorgain" });
      }
    }
  }

  // 3) No real data available — return empty rather than synthesizing points.
  return NextResponse.json({ history: [] });
}
