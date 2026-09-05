import { NextRequest, NextResponse } from "next/server";
import { runBacktest, BacktestCriteria } from "@/features/backtest/lib/backtest.service";
import { getClientKey, isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Clamp a query number into [min, max]; fall back when missing/non-finite. */
function num(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const n = value === null ? NaN : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Clamp an optional query number; undefined stays undefined. */
function optNum(value: string | null, min: number, max: number): number | undefined {
  if (value === null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(n, min), max);
}

export async function GET(request: NextRequest) {
  if (isRateLimited(`backtest:${getClientKey(request)}`, 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    const board = (searchParams.get("board") as "all" | "mainboard" | "sme") || "all";
    const sector = searchParams.get("sector") ?? undefined;

    const criteria: BacktestCriteria = {
      minGmpPercent: num(searchParams.get("minGmpPercent"), 0, 0, 1000),
      minQibSubscription: num(searchParams.get("minQibSubscription"), 0, 0, 10000),
      minRetailSubscription: num(searchParams.get("minRetailSubscription"), 0, 0, 10000),
      minTotalSubscription: num(searchParams.get("minTotalSubscription"), 0, 0, 10000),
      board: ["all", "mainboard", "sme"].includes(board) ? board : "all",
      minIssueSizeCr: optNum(searchParams.get("minIssueSizeCr"), 0, 1e7),
      maxIssueSizeCr: optNum(searchParams.get("maxIssueSizeCr"), 0, 1e7),
      sector: sector?.slice(0, 64),
    };

    const startingCapital = num(searchParams.get("startingCapital"), 100000, 1000, 1e9);
    const allocationPerIpo = num(searchParams.get("allocationPerIpo"), 15000, 1000, 1e8);

    const result = runBacktest(criteria, startingCapital, allocationPerIpo);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[/api/backtest] Error:", error);
    return NextResponse.json(
      { error: "Backtest failed. Please try again." },
      { status: 500 }
    );
  }
}
