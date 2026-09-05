import { CalendarIPO, DataSource, ProviderCredit } from "@/types/calendar.types";
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
  credit?: ProviderCredit;
}

const TTL_MS = 60 * 1000;

// globalThis so the cache survives module duplication across route bundles
// and warm serverless instances (a module-local `let` re-scrapes on every
// cold start and per-bundle).
const globalStore = globalThis as unknown as {
  __calendarCatalogueCache?: { at: number; result: CatalogueResult } | null;
};
if (globalStore.__calendarCatalogueCache === undefined) {
  globalStore.__calendarCatalogueCache = null;
}

function getCache(): { at: number; result: CatalogueResult } | null {
  return globalStore.__calendarCatalogueCache ?? null;
}

function setCache(result: CatalogueResult): void {
  globalStore.__calendarCatalogueCache = { at: Date.now(), result };
}

/** yyyy-mm-dd for "today" in IST (GMP moves on Indian market days). */
function todayIstDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

      // One snapshot row per IPO per IST calendar day: create the day's row
      // when missing, otherwise UPDATE it when the value moved — so intraday
      // GMP moves are recorded without exploding the table into dozens of
      // same-hour points.
      if (ipo.gmp !== undefined) {
        const latest = await prisma.gmpSnapshot.findFirst({
          where: { ipoId: dbIpo.id },
          orderBy: { date: "desc" },
        });
        const today = todayIstDate();
        const sameDay =
          latest?.date.toISOString().slice(0, 10) === today;
        if (!latest || !sameDay) {
          await prisma.gmpSnapshot.create({
            data: { ipoId: dbIpo.id, gmp: ipo.gmp, source: "investorgain" },
          });
        } else if (latest.gmp !== ipo.gmp) {
          await prisma.gmpSnapshot.update({
            where: { id: latest.id },
            data: { gmp: ipo.gmp, source: "investorgain" },
          });
        }
      }
    }
  } catch (err) {
    console.error("[calendar] DB persist failed (non-fatal):", err);
  }
}

export async function loadCatalogue(forceRefresh = false): Promise<CatalogueResult> {
  const cached = getCache();
  if (!forceRefresh && cached && Date.now() - cached.at < TTL_MS) {
    return cached.result;
  }

  for (const provider of liveProviders()) {
    try {
      const ipos = await provider.fetchCatalogue();
      if (ipos.length === 0) continue;
      const result: CatalogueResult = {
        ipos,
        source: provider.source,
        credit: provider.credit,
      };
      setCache(result);
      // Awaited: on serverless the function can freeze right after the
      // response, silently dropping fire-and-forget GMP snapshot writes.
      await persistToDb(ipos, provider.source);
      return result;
    } catch (err) {
      console.error("[calendar] live provider failed, trying next source:", err);
    }
  }

  const stale = getCache();
  if (stale) return stale.result;
  return { ipos: await seedProvider.fetchCatalogue(), source: "sample" };
}
