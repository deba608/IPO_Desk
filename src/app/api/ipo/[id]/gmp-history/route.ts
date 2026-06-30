import { NextResponse } from "next/server";
import { findCalendarIPO } from "@/features/ipo-calendar/lib/calendar.service";
import { checkDbAvailability, prisma } from "@/services/db.service";
import type { GMPEntry } from "@/types/calendar.types";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const ipo = await findCalendarIPO(id);
  if (!ipo) {
    return NextResponse.json({ history: [] });
  }

  const capPrice = ipo.priceBand.max;

  if (checkDbAvailability()) {
    try {
      const dbIpo = await prisma.ipo.findUnique({ where: { slug: id } });
      if (dbIpo) {
        const snapshots = await prisma.gmpSnapshot.findMany({
          where: { ipoId: dbIpo.id },
          orderBy: { date: "asc" },
          take: 30,
        });
        if (snapshots.length >= 2) {
          return NextResponse.json({
            history: snapshots.map((s: { date: Date; gmp: number }) => ({
              date: s.date.toISOString().split("T")[0],
              gmp: s.gmp,
              gainPercent: capPrice > 0 ? Math.round((s.gmp / capPrice) * 1000) / 10 : undefined,
            })),
          });
        }
      }
    } catch {
      // Fall through to demo data
    }
  }

  if (ipo.gmp === undefined) {
    return NextResponse.json({ history: [] });
  }

  const today = new Date();
  const entries: GMPEntry[] = [];

  for (let i = 14; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;

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
