// src/app/api/ipos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getActiveIPOs } from "@/services/ipo.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

    const ipoList = await getActiveIPOs(forceRefresh);

    return NextResponse.json(ipoList, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
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
