import { describe, it, expect } from "vitest";
import { deriveLifecycle, todayISO } from "./calendar.service";
import { CalendarIPO } from "@/types/calendar.types";

describe("Calendar Service - deriveLifecycle", () => {
  const baseIpo: CalendarIPO = {
    id: "test-ipo",
    name: "Test IPO Ltd",
    board: "mainboard",
    registrar: "kfintech",
    leadManagers: ["Kotak"],
    issueSizeCr: 500,
    priceBand: { min: 100, max: 105 },
    lotSize: 140,
    openDate: "2026-05-10",
    closeDate: "2026-05-12",
    allotmentDate: "2026-05-15",
    listingDate: "2026-05-18",
    exchanges: ["NSE", "BSE"],
  };

  it("identifies upcoming IPOs before open date", () => {
    expect(deriveLifecycle(baseIpo, "2026-05-01")).toBe("upcoming");
    expect(deriveLifecycle(baseIpo, "2026-05-09")).toBe("upcoming");
  });

  it("identifies open IPOs during subscription window", () => {
    expect(deriveLifecycle(baseIpo, "2026-05-10")).toBe("open");
    expect(deriveLifecycle(baseIpo, "2026-05-11")).toBe("open");
    expect(deriveLifecycle(baseIpo, "2026-05-12")).toBe("open");
  });

  it("identifies closed IPOs after close date before listing", () => {
    expect(deriveLifecycle(baseIpo, "2026-05-13")).toBe("closed");
    expect(deriveLifecycle(baseIpo, "2026-05-17")).toBe("closed");
  });

  it("identifies listed IPOs on and after listing date", () => {
    expect(deriveLifecycle(baseIpo, "2026-05-18")).toBe("listed");
    expect(deriveLifecycle(baseIpo, "2026-05-20")).toBe("listed");
  });

  it("returns a valid IST today string", () => {
    const today = todayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
