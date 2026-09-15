import { describe, expect, it } from "vitest";
import {
  BROKERS,
  getBrokerApplyUrl,
  getBrokerLabel,
  isValidPAN,
  maskPan,
} from "./brokers";

describe("brokers lib", () => {
  it("every broker has a public https apply URL", () => {
    for (const [k, b] of Object.entries(BROKERS)) {
      expect(b.label, k).toBeTruthy();
      expect(b.applyUrl, k).toMatch(/^https:\/\//);
    }
  });

  it("falls back to BSE eIPO for unknown broker", () => {
    expect(getBrokerApplyUrl("nope" as never)).toContain("bseindia");
    expect(getBrokerLabel("nope" as never)).toBeTruthy();
  });

  it("validates PAN format", () => {
    expect(isValidPAN("ABCDE1234F")).toBe(true);
    expect(isValidPAN("abcde1234f")).toBe(true); // case-insensitive
    expect(isValidPAN("ABCDE1234")).toBe(false);
    expect(isValidPAN("ABCDE1234FF")).toBe(false);
    expect(isValidPAN("12345")).toBe(false);
    expect(isValidPAN("")).toBe(false);
  });

  it("masks PAN for display", () => {
    expect(maskPan("ABCDE1234F")).toBe("AXXXXX23XF");
    expect(maskPan("ABCDE1234F")).not.toContain("BCDE");
  });
});
