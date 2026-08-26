// src/app/api/cron/sync-ipos/route.ts
// Scheduled sync endpoint — invoked by Vercel Cron every 6 hours
// (see vercel.json). Can also be hit manually to force a refresh.
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

    return NextResponse.json({
      ok: registrarResult.status === "fulfilled" || calendarResult.status === "fulfilled",
      synced: Object.values(counts).reduce((sum, n) => sum + n, 0),
      byRegistrar: counts,
      registrarError:
        registrarResult.status === "rejected"
          ? reasonMessage(registrarResult.reason)
          : undefined,
      calendar,
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
