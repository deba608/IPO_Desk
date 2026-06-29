"use client";

// CalendarHighlights — a compact "at a glance" strip above the grid: how many
// issues are open now, the highest-GMP issue, and the most-subscribed issue.
// Purely derived from the current dataset; hidden when nothing is notable.

import Link from "next/link";
import { Flame, TrendingUp, DoorOpen } from "lucide-react";
import { CalendarIPOWithStatus } from "@/types/calendar.types";

function topBy<T>(
  items: CalendarIPOWithStatus[],
  value: (i: CalendarIPOWithStatus) => T | undefined
): CalendarIPOWithStatus | undefined {
  let best: CalendarIPOWithStatus | undefined;
  let bestVal: number = -Infinity;
  for (const i of items) {
    const v = value(i);
    if (typeof v === "number" && Number.isFinite(v) && v > bestVal) {
      bestVal = v;
      best = i;
    }
  }
  return best;
}

function HighlightCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  accent: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function CalendarHighlights({ ipos }: { ipos: CalendarIPOWithStatus[] }) {
  const openCount = ipos.filter((i) => i.lifecycle === "open").length;
  // Only consider live (not-yet-listed) issues for GMP/subscription leaders.
  const live = ipos.filter((i) => i.lifecycle !== "listed");
  const topGmp = topBy(live, (i) => i.gmpPercent);
  const topSub = topBy(live, (i) => i.subscription?.total);

  if (openCount === 0 && !topGmp && !topSub) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <HighlightCard
        icon={DoorOpen}
        label="Open now"
        value={openCount > 0 ? `${openCount} IPO${openCount > 1 ? "s" : ""} accepting bids` : "None open"}
        accent="bg-emerald-500/15 text-emerald-400"
      />
      {topGmp && topGmp.gmpPercent !== undefined && (
        <HighlightCard
          icon={TrendingUp}
          label="Top GMP today"
          value={topGmp.name}
          sub={`₹${topGmp.gmp} (${topGmp.gmpPercent}%)`}
          href={`/ipo/${topGmp.id}`}
          accent="bg-blue-500/15 text-blue-400"
        />
      )}
      {topSub && topSub.subscription?.total !== undefined && (
        <HighlightCard
          icon={Flame}
          label="Most subscribed"
          value={topSub.name}
          sub={`${topSub.subscription.total}× total`}
          href={`/ipo/${topSub.id}`}
          accent="bg-orange-500/15 text-orange-400"
        />
      )}
    </div>
  );
}
