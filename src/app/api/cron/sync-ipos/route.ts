// src/app/api/cron/sync-ipos/route.ts
// Scheduled sync endpoint — invoked by Vercel Cron daily at midnight UTC
// (see vercel.json; Hobby plans only allow daily crons). Can also be hit
// manually to force a refresh.
//
// Two independent syncs run each tick:
//   1. Registrar allotment adapters (KFintech, Bigshare, …) via syncAllRegistrars.
//   2. The IPO Calendar catalogue via loadCatalogue(force) — this is the ONLY
//      path that persists GMP/subscription snapshots to the DB, so it must run
//      on schedule to build real GMP history (not just on organic page traffic).

import { NextRequest, NextResponse } from "next/server";
import { syncAllRegistrars } from "@/services/registrar-sync";
import { loadCatalogue } from "@/features/ipo-calendar/lib/providers";
import { bearerToken, secretsMatch } from "@/lib/server-secret";
import { checkDbAvailability, getPrisma } from "@/services/db.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed in production: an unset secret would leave this endpoint
  // open to anyone wanting to hammer the registrar scrapes on demand.
  if (!cronSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }

  if (cronSecret) {
    const token = bearerToken(request.headers.get("authorization"));
    if (!secretsMatch(token, cronSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Both syncs are independent — isolate failures so one can't hide the other.
    const [registrarResult, calendarResult] = await Promise.allSettled([
      syncAllRegistrars(),
      loadCatalogue(true),
    ]);

    const counts =
      registrarResult.status === "fulfilled" ? registrarResult.value : {};
    const calendar =
      calendarResult.status === "fulfilled"
        ? { count: calendarResult.value.ipos.length, source: calendarResult.value.source }
        : { error: reasonMessage(calendarResult.reason) };

    // Retention: drop orphaned alerts (IPO deleted → FK set null) and anything
    // older than 90 days. Best-effort — never fails the sync tick.
    let alertsPruned = 0;
    try {
      alertsPruned = await pruneAlerts();
    } catch (error: unknown) {
      console.error("[cron] alert prune failed (non-fatal):", error);
    }

    return NextResponse.json({
      ok: registrarResult.status === "fulfilled" || calendarResult.status === "fulfilled",
      synced: Object.values(counts).reduce((sum, n) => sum + n, 0),
      byRegistrar: counts,
      registrarError:
        registrarResult.status === "rejected"
          ? reasonMessage(registrarResult.reason)
          : undefined,
      calendar,
      alertsPruned,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

function reasonMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unknown error";
}

const ALERT_RETENTION_DAYS = 90;

async function pruneAlerts(): Promise<number> {
  if (!checkDbAvailability()) return 0;
  const prisma = await getPrisma();
  const cutoff = new Date(Date.now() - ALERT_RETENTION_DAYS * 24 * 3600 * 1000);
  const deleted = await prisma.alert.deleteMany({
    where: { OR: [{ ipoId: null }, { createdAt: { lt: cutoff } }] },
  });
  return deleted.count;
}
