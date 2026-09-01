import { NextRequest, NextResponse } from "next/server";
import { runBacktest, BacktestCriteria } from "@/features/backtest/lib/backtest.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const minGmpPercent = Number(searchParams.get("minGmpPercent") ?? "0");
  const minQibSubscription = Number(searchParams.get("minQibSubscription") ?? "0");
  const minRetailSubscription = Number(searchParams.get("minRetailSubscription") ?? "0");
  const minTotalSubscription = Number(searchParams.get("minTotalSubscription") ?? "0");
  const board = (searchParams.get("board") as "all" | "mainboard" | "sme") || "all";
  const minIssueSizeCr = searchParams.has("minIssueSizeCr")
    ? Number(searchParams.get("minIssueSizeCr"))
    : undefined;
  const maxIssueSizeCr = searchParams.has("maxIssueSizeCr")
    ? Number(searchParams.get("maxIssueSizeCr"))
    : undefined;
  const sector = searchParams.get("sector") ?? undefined;

  const criteria: BacktestCriteria = {
    minGmpPercent: Number.isFinite(minGmpPercent) ? minGmpPercent : 0,
    minQibSubscription: Number.isFinite(minQibSubscription) ? minQibSubscription : 0,
    minRetailSubscription: Number.isFinite(minRetailSubscription) ? minRetailSubscription : 0,
    minTotalSubscription: Number.isFinite(minTotalSubscription) ? minTotalSubscription : 0,
    board: ["all", "mainboard", "sme"].includes(board) ? board : "all",
    minIssueSizeCr: Number.isFinite(minIssueSizeCr) ? minIssueSizeCr : undefined,
    maxIssueSizeCr: Number.isFinite(maxIssueSizeCr) ? maxIssueSizeCr : undefined,
    sector,
  };

  const startingCapital = Number(searchParams.get("startingCapital") ?? "100000");
  const allocationPerIpo = Number(searchParams.get("allocationPerIpo") ?? "15000");

  const result = runBacktest(
    criteria,
    Number.isFinite(startingCapital) ? startingCapital : 100000,
    Number.isFinite(allocationPerIpo) ? allocationPerIpo : 15000
  );

  return NextResponse.json(result);
}
