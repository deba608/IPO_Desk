import { describe, it, expect } from "vitest";
import { generateReport } from "./report.service";
import { CalendarIPOWithStatus } from "@/types/calendar.types";

describe("Report Service - generateReport", () => {
  const mockIpo: CalendarIPOWithStatus = {
    id: "sample-tech",
    name: "Sample Tech Ltd",
    board: "mainboard",
    registrar: "kfintech",
    leadManagers: ["Kotak Mahindra Capital", "Axis Capital"],
    issueSizeCr: 2500,
    priceBand: { min: 450, max: 475 },
    lotSize: 31,
    minInvestment: 14725,
    openDate: "2026-06-01",
    closeDate: "2026-06-03",
    exchanges: ["NSE", "BSE"],
    lifecycle: "open",
    gmp: 120,
    gmpPercent: 25.3,
    subscription: {
      qib: 45.0,
      nii: 20.0,
      retail: 8.5,
      total: 28.0,
    },
  };

  it("generates structured report with all required sections", () => {
    const report = generateReport(mockIpo);
    expect(report.ipoId).toBe("sample-tech");
    expect(report.ipoName).toBe("Sample Tech Ltd");
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.sections.length).toBeGreaterThanOrEqual(4);
    expect(report.verdict).toBeDefined();
    expect(report.verdictLabel).toBeDefined();
  });

  it("assigns high score and apply verdict for strong metrics", () => {
    const report = generateReport(mockIpo);
    expect(report.overallScore).toBeGreaterThanOrEqual(65);
    expect(["strong_apply", "apply"]).toContain(report.verdict);
  });

  it("handles low/missing subscription & negative GMP gracefully", () => {
    const weakIpo: CalendarIPOWithStatus = {
      ...mockIpo,
      id: "weak-ipo",
      board: "sme",
      priceBand: { min: 100, max: 120 }, // 20% wide band
      gmp: -10,
      gmpPercent: -2.0,
      subscription: {
        qib: 0.5,
        nii: 0.2,
        retail: 0.4,
        total: 0.4,
      },
    };

    const report = generateReport(weakIpo);
    expect(report.overallScore).toBeLessThan(70);
    expect(report.verdict).toBeDefined();
  });
});
