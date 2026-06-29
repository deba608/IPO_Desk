// src/app/api/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/features/ipo-calendar/lib/calendar.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
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
