import { NextResponse } from "next/server";
import { findCalendarIPO } from "@/features/ipo-calendar/lib/calendar.service";
import type { GMPEntry } from "@/types/calendar.types";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const ipo = await findCalendarIPO(id);
  if (!ipo || ipo.gmp === undefined) {
    return NextResponse.json({ history: [] });
  }

  const today = new Date();
  const entries: GMPEntry[] = [];

  const capPrice = ipo.priceBand.max;

  // Generate ~14 days of realistic demo history converging to the current GMP.
  // Replace with a DB query when the data ingestion module ships.
  for (let i = 14; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);

    // Skip weekends
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;

    // Noise: random walk that trends toward the current GMP
    const progress = 1 - i / 14;
    const noise = (Math.random() - 0.5) * 8;
    const gmp = Math.round(Math.max(0, ipo.gmp * progress + noise * (1 - progress)));

    entries.push({
      date: d.toISOString().split("T")[0],
      gmp,
      gainPercent: capPrice > 0 ? Math.round((gmp / capPrice) * 1000) / 10 : undefined,
    });
  }

  return NextResponse.json({ history: entries });
}
