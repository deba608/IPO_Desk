// src/app/api/cron/sync-ipos/route.ts
// Scheduled sync endpoint — invoked by Vercel Cron every 6 hours
// (see vercel.json). Can also be hit manually to force a refresh.

import { NextRequest, NextResponse } from "next/server";
import { syncActiveIPOs } from "@/services/kfintech-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // When CRON_SECRET is set (recommended on Vercel), require it
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const ipos = await syncActiveIPOs();
    return NextResponse.json({
      ok: true,
      synced: ipos.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
