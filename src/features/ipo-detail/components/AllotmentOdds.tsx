"use client";

import { useMemo, useState } from "react";
import { Dices, Ticket, Minus, Plus, Wallet, Target } from "lucide-react";
import {
  computeOdds,
  chanceOfAtLeastOne,
  expectedLots,
  applicationsForConfidence,
} from "../lib/allotment-odds";
import { cn } from "@/lib/utils";

interface AllotmentOddsProps {
  /** Retail subscription multiple (×), from the subscription feed. */
  retailSubscription: number;
  /** Per-application cost at cut-off (retail minimum) in INR. */
  minInvestment: number;
}

const MAX_APPS = 50;

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function AllotmentOdds({
  retailSubscription,
  minInvestment,
}: AllotmentOddsProps) {
  const odds = useMemo(() => computeOdds(retailSubscription), [retailSubscription]);
  const [apps, setApps] = useState(() =>
    Math.min(MAX_APPS, Math.max(1, odds.oneInN))
  );

  const chance = chanceOfAtLeastOne(odds.perApplication, apps);
  const expLots = expectedLots(odds.perApplication, apps);
  const appsFor90 = applicationsForConfidence(odds.perApplication, 0.9);

  const clamp = (n: number) => Math.min(MAX_APPS, Math.max(1, n));

  if (odds.fullAllotment) {
    return (
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">
            Full allotment likely
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Retail is subscribed {retailSubscription.toFixed(2)}× — at or below 1×,
          every valid application typically receives its lot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Headline odds */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Dices className="h-4 w-4 text-primary" />
          </span>
          <div>
            <p className="text-lg font-bold leading-none">
              ≈ 1 in {odds.oneInN}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {pct(odds.perApplication)} chance per application
            </p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Retail subscribed{" "}
          <span className="font-medium text-foreground">
            {retailSubscription.toFixed(2)}×
          </span>
        </p>
      </div>

      {/* Interactive: applications → chance */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            If you apply with
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Fewer applications"
              onClick={() => setApps((a) => clamp(a - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              disabled={apps <= 1}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-14 text-center text-sm font-semibold tabular-nums">
              {apps} PAN{apps === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              aria-label="More applications"
              onClick={() => setApps((a) => clamp(a + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              disabled={apps >= MAX_APPS}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <input
          type="range"
          min={1}
          max={MAX_APPS}
          value={apps}
          onChange={(e) => setApps(clamp(Number(e.target.value)))}
          aria-label="Number of applications"
          className="mb-3 w-full accent-primary"
        />

        {/* Chance bar */}
        <div className="mb-1 flex items-end justify-between">
          <span className="text-xs text-muted-foreground">
            Chance of at least 1 lot
          </span>
          <span
            className={cn(
              "text-xl font-bold tabular-nums",
              chance >= 0.75
                ? "text-emerald-400"
                : chance >= 0.4
                ? "text-amber-400"
                : "text-foreground"
            )}
          >
            {pct(chance)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300 ease-out",
              chance >= 0.75
                ? "bg-emerald-500"
                : chance >= 0.4
                ? "bg-amber-500"
                : "bg-primary"
            )}
            style={{ width: `${Math.max(2, Math.round(chance * 100))}%` }}
          />
        </div>

        {/* Secondary stats */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-background/60 px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Target className="h-3 w-3" /> Expected lots
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {expLots.toFixed(2)}
            </p>
          </div>
          <div className="rounded-md bg-background/60 px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Wallet className="h-3 w-3" /> Capital needed
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {inr(apps * minInvestment)}
            </p>
          </div>
        </div>
      </div>

      {Number.isFinite(appsFor90) && (
        <p className="text-[11px] text-muted-foreground">
          Apply with{" "}
          <button
            type="button"
            onClick={() => setApps(clamp(appsFor90))}
            className="font-semibold text-primary hover:underline"
          >
            {appsFor90} PANs
          </button>{" "}
          for roughly a 90% shot at one lot
          {appsFor90 > MAX_APPS ? " (beyond the slider range)" : ""}.
        </p>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground/80">
        Estimate from the retail lottery model (~1 ÷ subscription per
        application). Actual registrar allotment rounds to whole lots and may
        differ. Each application must use a distinct PAN.
      </p>
    </div>
  );
}
