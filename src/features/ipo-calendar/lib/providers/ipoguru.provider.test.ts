// Unit tests for the IPO Guru provider's defensive normalizers.
// Field shapes below are taken from the LIVE API response verified on
// 2026-07-22 (e.g. issue_size "₹24.03 Cr", price_band "95", lot_size "1200"
// as strings, registrar/listing_on sometimes null).

import { describe, it, expect } from "vitest";
import {
  toNumber,
  toOptionalNumber,
  parsePriceBand,
  toISODate,
  parseBoard,
  parseExchanges,
  parseRegistrar,
  slugify,
  normalizeSubscription,
  normalize,
} from "./ipoguru.provider";

describe("toNumber", () => {
  it("strips ₹ and Cr suffixes", () => {
    expect(toNumber("₹24.03 Cr")).toBe(24.03);
    expect(toNumber("2,100.00 Cr")).toBe(2100);
    expect(toNumber("₹2,100.00")).toBe(2100);
  });
  it("passes finite numbers through", () => {
    expect(toNumber(2100)).toBe(2100);
    expect(toNumber(0)).toBe(0);
  });
  it("is NaN-safe → 0", () => {
    expect(toNumber("N/A")).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(Infinity)).toBe(0);
  });
});

describe("toOptionalNumber", () => {
  it("treats empty/null/undefined as undefined", () => {
    expect(toOptionalNumber("")).toBeUndefined();
    expect(toOptionalNumber(null)).toBeUndefined();
    expect(toOptionalNumber(undefined)).toBeUndefined();
  });
  it("returns undefined for unparseable strings, not 0", () => {
    expect(toOptionalNumber("N/A")).toBeUndefined();
  });
  it("preserves a real numeric 0", () => {
    expect(toOptionalNumber(0)).toBe(0);
  });
  it("parses numeric strings", () => {
    expect(toOptionalNumber("95")).toBe(95);
  });
});

describe("parsePriceBand", () => {
  it("collapses a single price to min === max", () => {
    expect(parsePriceBand("95")).toEqual({ min: 95, max: 95 });
  });
  it("parses a ₹ range", () => {
    expect(parsePriceBand("₹440 - ₹463")).toEqual({ min: 440, max: 463 });
  });
  it("orders regardless of input order", () => {
    expect(parsePriceBand("463-440")).toEqual({ min: 440, max: 463 });
  });
  it("defaults to {0,0} when absent", () => {
    expect(parsePriceBand(undefined)).toEqual({ min: 0, max: 0 });
    expect(parsePriceBand("TBA")).toEqual({ min: 0, max: 0 });
  });
});

describe("toISODate", () => {
  it("keeps an ISO date", () => {
    expect(toISODate("2026-07-27")).toBe("2026-07-27");
    expect(toISODate("2026-07-27T00:00:00Z")).toBe("2026-07-27");
  });
  it("parses a human date into IST-anchored ISO", () => {
    expect(toISODate("27 Jul 2026")).toBe("2026-07-27");
  });
  it("returns undefined for junk / empty", () => {
    expect(toISODate(undefined)).toBeUndefined();
    expect(toISODate("not a date")).toBeUndefined();
  });
});

describe("parseBoard", () => {
  it("maps SME variants to sme", () => {
    expect(parseBoard("SME")).toBe("sme");
    expect(parseBoard("BSE SME")).toBe("sme");
  });
  it("defaults everything else to mainboard", () => {
    expect(parseBoard("Mainboard")).toBe("mainboard");
    expect(parseBoard(undefined)).toBe("mainboard");
  });
});

describe("parseExchanges", () => {
  it("extracts named exchanges", () => {
    expect(parseExchanges("NSE, BSE")).toEqual(["NSE", "BSE"]);
    expect(parseExchanges("BSE SME")).toEqual(["BSE"]);
  });
  it("defaults to both when null/unknown", () => {
    expect(parseExchanges(null as unknown as string)).toEqual(["NSE", "BSE"]);
    expect(parseExchanges(undefined)).toEqual(["NSE", "BSE"]);
  });
});

describe("parseRegistrar", () => {
  it("matches known registrars case-insensitively", () => {
    expect(parseRegistrar("KFin Technologies")).toBe("kfintech");
    expect(parseRegistrar("Karvy")).toBe("kfintech");
    expect(parseRegistrar("Bigshare Services")).toBe("bigshare");
    expect(parseRegistrar("Link Intime")).toBe("linkintime");
    expect(parseRegistrar("MUFG Intime")).toBe("mufg");
  });
  it("defaults to kfintech for null/unknown", () => {
    expect(parseRegistrar(null as unknown as string)).toBe("kfintech");
    expect(parseRegistrar("Some Unknown Co")).toBe("kfintech");
  });
});

describe("slugify", () => {
  it("kebab-cases and trims", () => {
    expect(slugify("Advance Technoforge")).toBe("advance-technoforge");
    expect(slugify("Gulf Lloyds (India)")).toBe("gulf-lloyds-india");
  });
});

describe("normalizeSubscription", () => {
  it("returns undefined when absent or empty", () => {
    expect(normalizeSubscription(undefined)).toBeUndefined();
    expect(normalizeSubscription({})).toBeUndefined();
  });
  it("keeps a partial subscription", () => {
    const sub = normalizeSubscription({ retail: "3.78", total: "3.78", updated_at: "x" });
    expect(sub).toEqual({
      qib: undefined,
      nii: undefined,
      retail: 3.78,
      total: 3.78,
      updatedAt: "x",
    });
  });
});

describe("normalize", () => {
  it("normalizes a live SME record with null registrar/listing_on", () => {
    const out = normalize({
      name: "Advance Technoforge",
      type: "SME",
      status: "Upcoming",
      open_date: "2026-07-27",
      close_date: "2026-07-29",
      allotment_date: "2026-07-30",
      listing_date: "2026-08-03",
      listing_price: null as unknown as string,
      price_band: "95",
      lot_size: "1200",
      issue_size: "₹24.03 Cr",
      listing_on: null as unknown as string,
      registrar: null as unknown as string,
    });
    expect(out).not.toBeNull();
    expect(out).toMatchObject({
      id: "sme-advance-technoforge",
      name: "Advance Technoforge",
      board: "sme",
      registrar: "kfintech", // default when null
      issueSizeCr: 24.03,
      priceBand: { min: 95, max: 95 },
      lotSize: 1200,
      openDate: "2026-07-27",
      closeDate: "2026-07-29",
      exchanges: ["NSE", "BSE"], // default when listing_on null
    });
    expect(out?.gmp).toBeUndefined();
    expect(out?.subscription).toBeUndefined();
  });

  it("carries gmp + subscription when present", () => {
    const out = normalize({
      name: "Sotefin Bharat",
      type: "SME",
      open_date: "2026-07-16",
      close_date: "2026-07-20",
      price_band: "178-187",
      lot_size: "600",
      issue_size: "89.76 Cr",
      registrar: "Bigshare",
      gmp: { price: "1.5", updated_at: "22 Jul 2026" },
      subscription: { qib: "2.82", nii: "4.74", retail: "3.78", total: "3.78" },
    });
    expect(out?.registrar).toBe("bigshare");
    expect(out?.priceBand).toEqual({ min: 178, max: 187 });
    expect(out?.gmp).toBe(1.5);
    expect(out?.subscription?.total).toBe(3.78);
  });

  it("returns null for unusable records (missing name or dates)", () => {
    expect(normalize({ type: "SME", open_date: "2026-07-16", close_date: "2026-07-20" })).toBeNull();
    expect(normalize({ name: "No Dates" })).toBeNull();
    expect(normalize({ name: "Open Only", open_date: "2026-07-16" })).toBeNull();
  });
});
