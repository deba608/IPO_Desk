import { NextRequest, NextResponse } from "next/server";
import { syncAllRegistrars } from "@/services/registrar-sync";
import { getCalendar } from "@/features/ipo-calendar/lib/calendar.service";
import { log } from "@/services/logger.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const adminPasscode = request.headers.get("x-admin-passcode");
    const configuredSecret = process.env.ADMIN_PASSCODE || process.env.CRON_SECRET || "admin123";

    // Validate passcode or bearer token
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const isAuthorized =
      adminPasscode === configuredSecret ||
      token === configuredSecret ||
      process.env.NODE_ENV !== "production";

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const start = Date.now();
    log("info", "ipo_sync_success", "Admin triggered full sync & catalogue reload");

    // 1. Sync registrars for allotment checking
    const registrarResults = await syncAllRegistrars();

    // 2. Force-refresh calendar catalogue and live GMP feeds
    const calendarData = await getCalendar(true);

    const durationMs = Date.now() - start;

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
