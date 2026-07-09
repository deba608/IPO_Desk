import { CalendarIPO, DataSource } from "@/types/calendar.types";
import { CalendarProvider } from "./types";
import { seedProvider } from "./seed.provider";
import { createIpoGuruProvider } from "./ipoguru.provider";
import { createNseProvider } from "./nse.provider";
import { createInvestorGainProvider } from "./investorgain.provider";
import { checkDbAvailability, getPrisma } from "@/services/db.service";

type Board = "mainboard" | "sme";
type Registrar = "kfintech" | "linkintime" | "bigshare" | "mufg";

export interface CatalogueResult {
  ipos: CalendarIPO[];
  source: DataSource;
}

const TTL_MS = 60 * 1000;

let cache: { at: number; result: CatalogueResult } | null = null;

/** yyyy-mm-dd for "today" in UTC (snapshot dates are stored in UTC). */
function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function liveProviders(): CalendarProvider[] {
  const key = process.env.IPOGURU_API_KEY?.trim();
  const chain: CalendarProvider[] = [];
  if (key) chain.push(createIpoGuruProvider(key));
  chain.push(createInvestorGainProvider());
  chain.push(createNseProvider());
  return chain;
}

function mapBoard(b: string): Board {
  return b === "sme" ? "sme" : "mainboard";
}

function mapRegistrar(r: string): Registrar {
  if (r === "kfintech" || r === "mufg" || r === "bigshare" || r === "linkintime") return r;
  return "kfintech";
}

async function persistToDb(ipos: CalendarIPO[], source: DataSource): Promise<void> {
  if (!checkDbAvailability() || source === "sample") return;
  try {
    const prisma = await getPrisma();
    for (const ipo of ipos) {
      const dbIpo = await prisma.ipo.upsert({
        where: { slug: ipo.id },
        update: {
          name: ipo.name,
          symbol: ipo.symbol,
          board: mapBoard(ipo.board),
          registrar: mapRegistrar(ipo.registrar),
          issueSizeCr: ipo.issueSizeCr,
          priceBandMin: ipo.priceBand.min,
          priceBandMax: ipo.priceBand.max,
          lotSize: ipo.lotSize,
          minInvestment: ipo.lotSize * ipo.priceBand.max,
          openDate: new Date(ipo.openDate + "T00:00:00Z"),
          closeDate: new Date(ipo.closeDate + "T00:00:00Z"),
          allotmentDate: ipo.allotmentDate ? new Date(ipo.allotmentDate + "T00:00:00Z") : null,
          listingDate: ipo.listingDate ? new Date(ipo.listingDate + "T00:00:00Z") : null,
          exchanges: ipo.exchanges,
          leadManagers: ipo.leadManagers,
        },
        create: {
          slug: ipo.id,
          name: ipo.name,
          symbol: ipo.symbol,
          board: mapBoard(ipo.board),
          registrar: mapRegistrar(ipo.registrar),
          issueSizeCr: ipo.issueSizeCr,
          priceBandMin: ipo.priceBand.min,
          priceBandMax: ipo.priceBand.max,
          lotSize: ipo.lotSize,
          minInvestment: ipo.lotSize * ipo.priceBand.max,
          openDate: new Date(ipo.openDate + "T00:00:00Z"),
          closeDate: new Date(ipo.closeDate + "T00:00:00Z"),
          allotmentDate: ipo.allotmentDate ? new Date(ipo.allotmentDate + "T00:00:00Z") : null,
          listingDate: ipo.listingDate ? new Date(ipo.listingDate + "T00:00:00Z") : null,
          exchanges: ipo.exchanges,
          leadManagers: ipo.leadManagers,
          status: "open",
        },
      });

      // Record at most ONE GMP snapshot per IPO per calendar day, and only when
      // the value actually moved. Without this, the calendar's 60s refresh (and
      // every serverless cold start) would insert a duplicate row on each load —
      // exploding the table and collapsing the "daily history" chart into dozens
      // of same-hour points.
      if (ipo.gmp !== undefined) {
        const latest = await prisma.gmpSnapshot.findFirst({
          where: { ipoId: dbIpo.id },
          orderBy: { date: "desc" },
        });
        const sameDay =
          latest && latest.date.toISOString().slice(0, 10) === todayUtcDate();
        const unchanged = latest && latest.gmp === ipo.gmp;
        if (!sameDay && !unchanged) {
          await prisma.gmpSnapshot.create({
            data: { ipoId: dbIpo.id, gmp: ipo.gmp, source: "investorgain" },
          });
        }
      }
    }
  } catch (err) {
    console.error("[calendar] DB persist failed (non-fatal):", err);
  }
}

export async function loadCatalogue(forceRefresh = false): Promise<CatalogueResult> {
  if (!forceRefresh && cache && Date.now() - cache.at < TTL_MS) {
    return cache.result;
  }

  for (const provider of liveProviders()) {
    try {
      const ipos = await provider.fetchCatalogue();
      if (ipos.length === 0) continue;
      const result: CatalogueResult = { ipos, source: provider.source };
      cache = { at: Date.now(), result };
      persistToDb(ipos, provider.source);
      return result;
    } catch (err) {
      console.error("[calendar] live provider failed, trying next source:", err);
    }
  }

  if (cache) return cache.result;
  return { ipos: await seedProvider.fetchCatalogue(), source: "sample" };
}
