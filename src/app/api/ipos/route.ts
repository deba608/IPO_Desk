// src/app/api/ipos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getActiveIPOs } from "@/services/ipo.service";
import { bearerToken, secretsMatch } from "@/lib/server-secret";

export const dynamic = "force-dynamic";

// ?refresh=true forces a live re-scrape of every registrar. Left open it is a
// cache-bust DoS amplifier, so require CRON_SECRET via Bearer header only
// (never ?secret= — URLs leak into logs/history/Referer). Without a secret
// configured, refresh requests silently fall back to cached data.
function isAuthorizedRefresh(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return secretsMatch(
    bearerToken(request.headers.get("authorization")),
    secret
  );
}

export async function GET(request: NextRequest) {
  try {
    const wantsRefresh =
      request.nextUrl.searchParams.get("refresh") === "true";
    const forceRefresh = wantsRefresh && isAuthorizedRefresh(request);

    const ipoList = await getActiveIPOs(forceRefresh);

    return NextResponse.json(ipoList, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
      },
    });
  } catch (error: unknown) {
    console.error("[/api/ipos] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch IPO list" },
      { status: 500 }
    );
  }
}
