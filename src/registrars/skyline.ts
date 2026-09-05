// src/registrars/skyline.ts
// Skyline Financial Services Registrar Adapter — Live
//
// Integration research (verified 2026-09-05 via direct portal probes):
//   - IPO list:  GET https://www.skylinerta.com/ipo.php
//                → server-rendered <select name="company"> with
//                <option value="<numeric id>">COMPANY NAME</option>
//   - Allotment: POST https://www.skylinerta.com/display_application.php
//                body {company: "<id>"} → search form with per-request
//                csrf_token (hidden input) + session cookie
//                POST display_application.php
//                body {company, csrf_token, action: "search", pan,
//                      client_id: "", application_no: ""}
//                → result HTML. "No record found. We could not find any
//                application matching the details entered." means not_found.
//                No CAPTCHA, no auth. DP/Client ID and Application No modes
//                exist on the same form; PAN mode is implemented (the adapter
//                interface only carries a PAN).

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { log } from "@/services/logger.service";
import { bulkCheck, createCookieSession, withRetry } from "./shared";

const SKYLINE_BASE_URL = "https://www.skylinerta.com";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractCsrfToken(html: string): string | null {
  const m = html.match(
    /name=["']csrf_token["'][^>]*value=["']([^"']+)["']/i
  );
  return m ? m[1] : null;
}

function extractCompanyOptions(html: string): { id: string; name: string }[] {
  const selectMatch = html.match(
    /<select[^>]*name=["']company["'][^>]*>([\s\S]*?)<\/select>/i
  );
  if (!selectMatch) return [];
  const out: { id: string; name: string }[] = [];
  const optionRe = /<option[^>]*\bvalue="(\d+)"[^>]*>([\s\S]*?)<\/option>/gi;
  let match: RegExpExecArray | null;
  while ((match = optionRe.exec(selectMatch[1])) !== null) {
    const name = stripTags(match[2]).trim();
    if (match[1] && name) out.push({ id: match[1], name });
  }
  return out;
}

const NOT_FOUND_PATTERNS =
  /no\s*record\s*found|could\s*not\s*find\s*any\s*application|not\s*found|not\s*applied|no\s*data|invalid\s*(pan|application)|please\s*check\s*your\s*details/i;

/**
 * Pull share counts out of the result table. Rows are matched by keyword so
 * minor markup changes don't silently flip applied/allotted.
 */
function extractShares(html: string): {
  name?: string;
  applied?: number;
  allotted?: number;
  hasTable: boolean;
} {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  let name: string | undefined;
  let applied: number | undefined;
  let allotted: number | undefined;

  for (const table of tables) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    for (const row of rows) {
      const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map((c) =>
        stripTags(c)
      );
      const text = cells.join(" ");
      if (/name/i.test(text) && !name) {
        const candidate = cells[cells.length - 1];
        if (candidate && !/name/i.test(candidate)) name = candidate;
      }
      if (/allot/i.test(text) && allotted === undefined) {
        const n = text.match(/(\d[\d,]*)/);
        if (n) allotted = Number(n[1].replace(/,/g, ""));
      } else if (/appl/i.test(text) && applied === undefined) {
        const n = text.match(/(\d[\d,]*)/);
        if (n) applied = Number(n[1].replace(/,/g, ""));
      }
    }
  }

  return { name, applied, allotted, hasTable: tables.length > 0 };
}

export class SkylineAdapter implements RegistrarAdapter {
  readonly name = "skyline";
  readonly displayName = "Skyline Financial Services Pvt. Ltd.";

  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 20000,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  }

  async getActiveIPOs(): Promise<IPO[]> {
    const started = Date.now();
    const response = await withRetry(() =>
      this.http.get<string>(`${SKYLINE_BASE_URL}/ipo.php`)
    );

    const syncedAt = new Date().toISOString();
    const ipos: IPO[] = extractCompanyOptions(response.data ?? "").map(
      (opt) => ({
        id: `${this.name}-${opt.id}`,
        clientId: opt.id,
        name: opt.name,
        registrar: "skyline",
        status: "ACTIVE",
        lastSyncedAt: syncedAt,
      })
    );

    log("info", "ipo_sync_success", `Fetched ${ipos.length} active IPOs from Skyline`, {
      durationMs: Date.now() - started,
      meta: { count: ipos.length, registrar: this.name },
    });
    return ipos;
  }

  async checkAllotment(pan: string, clientId: string): Promise<AllotmentResult> {
    const normalizedPan = pan.toUpperCase().trim();
    const started = Date.now();
    // Cookie-jar session (same helper as Purva): persists the PHP session
    // across the form → search steps and survives any redirect hops that
    // would otherwise drop intermediate Set-Cookie headers.
    const session = createCookieSession(this.http);

    try {
      // Step 1: load the search form for this company → csrf token + session.
      const formResponse = await withRetry(() =>
        session.post(
          `${SKYLINE_BASE_URL}/display_application.php`,
          new URLSearchParams({ company: clientId }).toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        )
      );
      const csrfToken = extractCsrfToken(formResponse.data ?? "");
      if (!csrfToken) {
        log("warn", "pan_check_failure", "Skyline search form had no CSRF token", {
          meta: { clientId, registrar: this.name },
        });
        return {
          pan: normalizedPan,
          status: "error",
          error: "Registrar returned an unrecognized response format.",
        };
      }

      // Step 2: submit the PAN search in the same session.
      const response = await withRetry(() =>
        session.post(
          `${SKYLINE_BASE_URL}/display_application.php`,
          new URLSearchParams({
            company: clientId,
            csrf_token: csrfToken,
            action: "search",
            pan: normalizedPan,
            client_id: "",
            application_no: "",
          }).toString(),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Referer: `${SKYLINE_BASE_URL}/display_application.php`,
            },
          }
        )
      );

      const html = response.data ?? "";
      const text = stripTags(html);

      log("info", "api_response_time", "Skyline PAN query completed", {
        durationMs: Date.now() - started,
        meta: { clientId, registrar: this.name },
      });

      if (NOT_FOUND_PATTERNS.test(text)) {
        return { pan: normalizedPan, status: "not_found" };
      }

      const parsed = extractShares(html);
      if (!parsed.hasTable) {
        log("warn", "pan_check_failure", "Skyline response had no result table", {
          meta: { clientId, registrar: this.name },
        });
        return {
          pan: normalizedPan,
          status: "error",
          error: "Registrar returned an unrecognized response format.",
        };
      }

      const allottedShares = parsed.allotted ?? 0;
      return {
        pan: normalizedPan,
        name: parsed.name,
        appliedShares: parsed.applied,
        allottedShares,
        status: allottedShares > 0 ? "allotted" : "not_allotted",
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string };

      log("error", "pan_check_failure", `Skyline PAN check failed: ${err.message ?? "unknown"}`, {
        durationMs: Date.now() - started,
        meta: { clientId, registrar: this.name, httpStatus: err.response?.status ?? "none" },
      });

      if (!err.response) {
        return { pan: normalizedPan, status: "error", error: "Network error. Please try again." };
      }
      if (err.response.status === 429) {
        return {
          pan: normalizedPan,
          status: "error",
          error: "Rate limit exceeded. Please wait before retrying.",
        };
      }
      return {
        pan: normalizedPan,
        status: "error",
        error: `API error: ${err.response.status ?? err.message}`,
      };
    }
  }

  async checkBulkAllotment(pans: string[], clientId: string): Promise<AllotmentResult[]> {
    return bulkCheck(pans, (pan) => this.checkAllotment(pan, clientId));
  }
}

export const skylineAdapter = new SkylineAdapter();
