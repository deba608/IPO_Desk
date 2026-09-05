import { NextRequest, NextResponse } from "next/server";
import { syncAllRegistrars } from "@/services/registrar-sync";
import { getCalendar } from "@/features/ipo-calendar/lib/calendar.service";
import { log } from "@/services/logger.service";
import { bearerToken, secretsMatch } from "@/lib/server-secret";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Fail closed: without a configured secret this endpoint stays disabled
    // in every environment — never fall back to a default passcode.
    const configuredSecret =
      process.env.ADMIN_PASSCODE || process.env.CRON_SECRET;
    if (!configuredSecret) {
      return NextResponse.json(
        { error: "Admin access not configured" },
        { status: 503 }
      );
    }

    // Constant-time comparison of either credential style; no env bypass.
    const passcode = request.headers.get("x-admin-passcode");
    const token = bearerToken(request.headers.get("authorization"));
    const isAuthorized =
      secretsMatch(passcode, configuredSecret) ||
      secretsMatch(token, configuredSecret);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const start = Date.now();

    // 1. Sync registrars for allotment checking
    const registrarResults = await syncAllRegistrars();

    // 2. Force-refresh calendar catalogue and live GMP feeds
    const calendarData = await getCalendar(true);

    const durationMs = Date.now() - start;
    log("info", "ipo_sync_success", "Admin triggered full sync & catalogue reload", {
      durationMs,
    });

    return NextResponse.json({
      success: true,
      durationMs,
      timestamp: new Date().toISOString(),
      registrarResults,
      calendar: {
        total: calendarData.total,
        counts: calendarData.counts,
        dataSource: calendarData.dataSource,
        credit: calendarData.credit,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    log("error", "ipo_sync_failure", `Admin sync failed: ${message}`);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
