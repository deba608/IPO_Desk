// src/app/api/logs/route.ts
// Debug endpoint exposing recent sync/check logs (in-memory ring buffer).

import { NextRequest, NextResponse } from "next/server";
import { getLogs, LogEvent } from "@/services/logger.service";
import { bearerToken, secretsMatch } from "@/lib/server-secret";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Debug endpoint — in production require CRON_SECRET; without one it is
  // disabled entirely rather than leaking sync failures publicly.
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || !secretsMatch(bearerToken(request.headers.get("authorization")), secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const event = request.nextUrl.searchParams.get("event") as LogEvent | null;
  const parsedLimit = Number(request.nextUrl.searchParams.get("limit") ?? "200");
  // Clamp to a sane range: limit=0 must not mean "everything".
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 1000)
    : 200;

  const logs = getLogs(event ?? undefined, limit);
  return NextResponse.json({ total: logs.length, logs });
}
