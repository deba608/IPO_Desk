import { describe, it, expect, vi } from "vitest";
import { SkylineAdapter } from "./skyline";
import { PurvaAdapter } from "./purva";
import { MaashitlaAdapter } from "./maashitla";

const SKYLINE_LIST_HTML = `
<select name="company" id="company">
  <option value="">Select Company</option>
  <option value="3418">ACETECH E-COMMERCE LIMITED</option>
  <option value="4175">AEGEUS TECHNOLOGIES LIMITED</option>
</select>`;

const SKYLINE_FORM_HTML = `
<form name="display_application" action="display_application.php" method="post">
  <input type="hidden" name="csrf_token" value="token123" />
  <input type="hidden" name="company" value="3418" />
</form>`;

const SKYLINE_NOT_FOUND_HTML = `
<html><body><div>No record found. We could not find any application
matching the details entered. Please check your details and try again.</div></body></html>`;

const PURVA_LIST_HTML = `
<select name="company_id" id="company_id" required>
  <option value="">Choose a company...</option>
  <option value="91">PRAMODINI MEDICARE PRIVATE LIMITED</option>
</select>`;

const PURVA_FORM_HTML = `
<form method='POST' id='ipo-query' action="/investor-service/ipo-query">
  <input type="hidden" name="csrfmiddlewaretoken" value="csrf456" />
</form>` + PURVA_LIST_HTML;

const PURVA_NOT_FOUND_HTML = `
<html><body><div class="result">No record found for the given PAN.</div></body></html>`;

describe("Skyline adapter", () => {
  it("parses the IPO dropdown into namespaced IPOs", async () => {
    const adapter = new SkylineAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "get").mockResolvedValueOnce({ data: SKYLINE_LIST_HTML });

    const ipos = await adapter.getActiveIPOs();
    expect(ipos).toHaveLength(2);
    expect(ipos[0]).toMatchObject({
      id: "skyline-3418",
      clientId: "3418",
      name: "ACETECH E-COMMERCE LIMITED",
      registrar: "skyline",
    });
  });

  it("returns not_found on the 'No record found' sentinel", async () => {
    const adapter = new SkylineAdapter();
    // @ts-expect-error accessing private property for unit testing
    const post = vi.spyOn(adapter.http, "post");
    post.mockResolvedValueOnce({
      data: SKYLINE_FORM_HTML,
      headers: { "set-cookie": ["PHPSESSID=abc; path=/"] },
    });
    post.mockResolvedValueOnce({ data: SKYLINE_NOT_FOUND_HTML, headers: {} });

    const res = await adapter.checkAllotment("ABCDE1234F", "3418");
    expect(res.status).toBe("not_found");
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("returns error when the search form has no CSRF token", async () => {
    const adapter = new SkylineAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "post").mockResolvedValueOnce({
      data: "<html><body>unexpected</body></html>",
      headers: {},
    });

    const res = await adapter.checkAllotment("ABCDE1234F", "3418");
    expect(res.status).toBe("error");
  });
});

describe("Purva adapter", () => {
  it("parses the company dropdown into namespaced IPOs", async () => {
    const adapter = new PurvaAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "get").mockResolvedValueOnce({ data: PURVA_LIST_HTML });

    const ipos = await adapter.getActiveIPOs();
    expect(ipos).toHaveLength(1);
    expect(ipos[0]).toMatchObject({
      id: "purva-91",
      clientId: "91",
      name: "PRAMODINI MEDICARE PRIVATE LIMITED",
      registrar: "purva",
    });
  });

  it("returns not_found on the no-record sentinel", async () => {
    const adapter = new PurvaAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "get").mockResolvedValueOnce({
      data: PURVA_FORM_HTML,
      headers: { "set-cookie": ["csrftoken=xyz; path=/"] },
    });
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "post").mockResolvedValueOnce({
      data: PURVA_NOT_FOUND_HTML,
      headers: {},
    });

    const res = await adapter.checkAllotment("ABCDE1234F", "91");
    expect(res.status).toBe("not_found");
  });
});

describe("Maashitla adapter", () => {
  it("maps public-issue companies into namespaced IPOs", async () => {
    const adapter = new MaashitlaAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "get").mockResolvedValueOnce({
      data: [
        { company_id: "5cea0581-9ab6-41c7-a9a7-d019be5bfe69", company_name: "TECHNOCRATS PLASMA SYSTEMS LIMITED" },
      ],
    });

    const ipos = await adapter.getActiveIPOs();
    expect(ipos).toHaveLength(1);
    expect(ipos[0]).toMatchObject({
      id: "maashitla-5cea0581-9ab6-41c7-a9a7-d019be5bfe69",
      clientId: "5cea0581-9ab6-41c7-a9a7-d019be5bfe69",
      name: "TECHNOCRATS PLASMA SYSTEMS LIMITED",
      registrar: "maashitla",
    });
  });

  it("returns allotted when shares_alloted > 0", async () => {
    const adapter = new MaashitlaAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "get").mockResolvedValueOnce({
      data: {
        company_name: "TECHNOCRATS PLASMA SYSTEMS LIMITED",
        pan: "ABCDE1234F",
        application_no: "123",
        dpid_client_id: "",
        name: "TEST USER",
        shares_applied: 100,
        shares_alloted: 50,
      },
    });

    // company_name passed directly skips the companies-list lookup.
    const res = await adapter.checkAllotment("ABCDE1234F", "TECHNOCRATS PLASMA SYSTEMS LIMITED");
    expect(res.status).toBe("allotted");
    expect(res.allottedShares).toBe(50);
    expect(res.appliedShares).toBe(100);
  });

  it("returns not_found on HTTP 404", async () => {
    const adapter = new MaashitlaAdapter();
    // @ts-expect-error accessing private property for unit testing
    vi.spyOn(adapter.http, "get").mockRejectedValueOnce({
      response: { status: 404, data: { detail: "Not found" } },
    });

    const res = await adapter.checkAllotment("ABCDE1234F", "TECHNOCRATS PLASMA SYSTEMS LIMITED");
    expect(res.status).toBe("not_found");
    expect(res.error).toBeUndefined();
  });
});
