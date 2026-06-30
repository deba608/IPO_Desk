import { NextResponse } from "next/server";
import { findCalendarIPO } from "@/features/ipo-calendar/lib/calendar.service";
import { generateReport } from "@/services/report.service";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const ipo = await findCalendarIPO(id);
  if (!ipo) {
    return NextResponse.json({ error: "IPO not found" }, { status: 404 });
  }

  const report = generateReport(ipo);
  return NextResponse.json(report);
}
