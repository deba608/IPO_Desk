import { describe, it, expect } from "vitest";
import { runBacktest, STRATEGY_PRESETS, exportBacktestToCsv } from "./backtest.service";

describe("Backtest Service", () => {
  it("runs backtest with high GMP preset successfully", () => {
    const preset = STRATEGY_PRESETS.find((p) => p.id === "high_gmp_momentum")!;
    expect(preset).toBeDefined();

    const result = runBacktest(preset.criteria);
    expect(result.totalHistoricalIpos).toBeGreaterThan(15);
    expect(result.matchedCount).toBeGreaterThan(0);
    expect(result.winRatePercent).toBeGreaterThan(50);
    expect(result.avgListingGainPercent).toBeGreaterThan(15);
    expect(result.distribution.length).toBe(5);
  });

  it("filters correctly by board", () => {
    const mainboardResult = runBacktest({
      minGmpPercent: 0,
      minQibSubscription: 0,
      minRetailSubscription: 0,
      minTotalSubscription: 0,
      board: "mainboard",
    });

    for (const ipo of mainboardResult.matchedIpos) {
      expect(ipo.board).toBe("mainboard");
    }

    const smeResult = runBacktest({
      minGmpPercent: 0,
      minQibSubscription: 0,
      minRetailSubscription: 0,
      minTotalSubscription: 0,
      board: "sme",
    });

    for (const ipo of smeResult.matchedIpos) {
      expect(ipo.board).toBe("sme");
    }
  });

  it("exports results to valid CSV string", () => {
    const result = runBacktest(STRATEGY_PRESETS[0].criteria);
    const csv = exportBacktestToCsv(result);

    expect(csv).toContain("Name,Symbol,Board,Sector");
    expect(csv.split("\n").length).toBe(result.matchedCount + 1);
  });

  it("handles impossible filter criteria gracefully", () => {
    const emptyResult = runBacktest({
      minGmpPercent: 500, // No IPO has 500% GMP
      minQibSubscription: 5000,
      minRetailSubscription: 5000,
      minTotalSubscription: 5000,
      board: "all",
    });

    expect(emptyResult.matchedCount).toBe(0);
    expect(emptyResult.winCount).toBe(0);
    expect(emptyResult.winRatePercent).toBe(0);
    expect(emptyResult.simulatedProfit).toBe(0);
  });
});
