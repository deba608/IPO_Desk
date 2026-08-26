// src/app/api/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/features/ipo-calendar/lib/calendar.service";
import { bearerToken, secretsMatch } from "@/lib/server-secret";

export const dynamic = "force-dynamic";

// ?refresh=true triggers live provider scraping + DB snapshot writes per hit —
// gate it behind CRON_SECRET like the other refresh paths. Without a secret
// configured, refresh requests fall back to the cached calendar.
function isAuthorizedRefresh(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    secretsMatch(bearerToken(request.headers.get("authorization")), secret) ||
    secretsMatch(request.nextUrl.searchParams.get("secret"), secret)
  );
}

export async function GET(request: NextRequest) {
  try {
    const wantsRefresh =
      request.nextUrl.searchParams.get("refresh") === "true";
    const forceRefresh = wantsRefresh && isAuthorizedRefresh(request);
    const calendar = await getCalendar(forceRefresh);

    return NextResponse.json(calendar, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
      },
    });
  } catch (error: unknown) {
    console.error("[/api/calendar] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch IPO calendar" },
      { status: 500 }
    );
  }
}
