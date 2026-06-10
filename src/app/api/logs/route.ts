// src/app/api/logs/route.ts
// Debug endpoint exposing recent sync/check logs (in-memory ring buffer).

import { NextRequest, NextResponse } from "next/server";
import { getLogs, LogEvent } from "@/services/logger.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const event = request.nextUrl.searchParams.get("event") as LogEvent | null;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "200");

  const logs = getLogs(event ?? undefined, Number.isFinite(limit) ? limit : 200);
  return NextResponse.json({ total: logs.length, logs });
}
