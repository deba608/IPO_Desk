import { describe, it, expect, vi } from "vitest";
import { BigShareAdapter } from "./bigshare";
import { KFinTechAdapter } from "./kfintech";
import { MUFGAdapter } from "./mufg";

describe("Registrar Adapters - Unapplied PAN handling (not_found instead of error)", () => {
  it("Bigshare returns not_found when registrar returns 'Please Enter Valid PAN' sentinel", async () => {
    const adapter = new BigShareAdapter();
    // Mock captcha token fetch before mocking post
    vi.spyOn(adapter, "fetchCaptchaToken").mockResolvedValue({ token: "mock-token", answer: "1234" });
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "post").mockResolvedValueOnce({
      data: {
        d: {
          APPLICATION_NO: "",
          DPID: "Please Enter Valid PAN / Application No / DP Client ID",
          Name: "",
          APPLIED: "",
          ALLOTED: "",
        },
      },
    });

    const res = await adapter.checkAllotment("ABCDE1234F", "123");
    expect(res.status).toBe("not_found");
    expect(res.error).toBeUndefined();
  });

  it("Bigshare returns not_found when status is NOTFOUND", async () => {
    const adapter = new BigShareAdapter();
    vi.spyOn(adapter, "fetchCaptchaToken").mockResolvedValue({ token: "mock-token", answer: "1234" });
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "post").mockResolvedValueOnce({
      data: {
        d: {
          Status: "NOTFOUND",
          APPLICATION_NO: "",
          DPID: "",
          Name: "",
          APPLIED: "",
          ALLOTED: "",
        },
      },
    });

    const res = await adapter.checkAllotment("ABCDE1234F", "123");
    expect(res.status).toBe("not_found");
  });

  it("KFintech returns not_found when data array is empty or record has No Record Found", async () => {
    const adapter = new KFinTechAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "get").mockResolvedValueOnce({
      data: {
        data: [],
      },
    });

    const res = await adapter.checkAllotment("ABCDE1234F", "123");
    expect(res.status).toBe("not_found");
    expect(res.error).toBeUndefined();
  });

  it("KFintech returns not_found when Name contains 'NO RECORD FOUND'", async () => {
    const adapter = new KFinTechAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "get").mockResolvedValueOnce({
      data: {
        data: [
          {
            Name: "NO RECORD FOUND",
            Pan_No: "",
            App_Shares: "",
            All_Shares: "",
          },
        ],
      },
    });

    const res = await adapter.checkAllotment("ABCDE1234F", "123");
    expect(res.status).toBe("not_found");
  });

  it("MUFG returns not_found when XML is empty or has no table", async () => {
    const adapter = new MUFGAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "post").mockResolvedValueOnce({
      data: {
        d: "<NewDataSet />",
      },
    });

    const res = await adapter.checkAllotment("ABCDE1234F", "123");
    expect(res.status).toBe("not_found");
    expect(res.error).toBeUndefined();
  });

  it("MUFG returns not_found when XML has sentinel Record Not Found", async () => {
    const adapter = new MUFGAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "post").mockResolvedValueOnce({
      data: {
        d: "<NewDataSet><Table><company_id>123</company_id><msg>Record Not Found</msg></Table></NewDataSet>",
      },
    });

    const res = await adapter.checkAllotment("ABCDE1234F", "123");
    expect(res.status).toBe("not_found");
  });
});
