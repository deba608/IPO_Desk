// src/registrars/purva.ts
// Purva Sharegistry (India) Registrar Adapter — Live
//
// Integration research (verified 2026-09-05 via direct portal probes):
//   - IPO list:  GET https://www.purvashare.com/investor-service/ipo-query
//                → Django form with <select name="company_id"> options
//                (<option value="<numeric id>">COMPANY NAME</option>)
//   - Allotment: POST /investor-service/ipo-query (same URL, form-encoded)
//                body {csrfmiddlewaretoken, company_id, applicationNumber: "",
//                      panNumber: "<PAN>"} with session cookie + Referer
//                → result HTML. No CAPTCHA, no auth. DP-ID mode is not part
//                of this form; PAN mode is implemented (the adapter interface
//                only carries a PAN).

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { log } from "@/services/logger.service";
import { bulkCheck, withRetry } from "./shared";

const PURVA_BASE_URL = "https://www.purvashare.com";
const PURVA_QUERY_PATH = "/investor-service/ipo-query";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cookiesFromHeaders(headers: unknown): string {
  const raw = (headers as { "set-cookie"?: string[] })?.["set-cookie"];
  if (!Array.isArray(raw)) return "";
  return raw
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function extractCsrfToken(html: string): string | null {
  const m = html.match(
    /name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["']/i
  );
  return m ? m[1] : null;
}

function extractCompanyOptions(html: string): { id: string; name: string }[] {
  const selectMatch = html.match(
    /<select[^>]*name=["']company_id["'][^>]*>([\s\S]*?)<\/select>/i
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
  /no\s*record|not\s*found|not\s*applied|no\s*data|invalid\s*(pan|application)|no\s*result|does\s*not\s*exist/i;

export class PurvaAdapter implements RegistrarAdapter {
  readonly name = "purva";
  readonly displayName = "Purva Sharegistry (India) Pvt. Ltd.";

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
      this.http.get<string>(`${PURVA_BASE_URL}${PURVA_QUERY_PATH}`)
    );

    const syncedAt = new Date().toISOString();
    const ipos: IPO[] = extractCompanyOptions(response.data ?? "").map(
      (opt) => ({
        id: `${this.name}-${opt.id}`,
        clientId: opt.id,
        name: opt.name,
        registrar: "purva",
        status: "ACTIVE",
        lastSyncedAt: syncedAt,
      })
    );

    log("info", "ipo_sync_success", `Fetched ${ipos.length} active IPOs from Purva`, {
      durationMs: Date.now() - started,
      meta: { count: ipos.length, registrar: this.name },
    });
    return ipos;
  }

  async checkAllotment(pan: string, clientId: string): Promise<AllotmentResult> {
    const normalizedPan = pan.toUpperCase().trim();
    const started = Date.now();

    try {
      // Step 1: load the query form → CSRF token + session cookie.
      const formResponse = await withRetry(() =>
        this.http.get<string>(`${PURVA_BASE_URL}${PURVA_QUERY_PATH}`)
      );
      const cookies = cookiesFromHeaders(formResponse.headers);
      const csrfToken = extractCsrfToken(formResponse.data ?? "");
      if (!csrfToken) {
        log("warn", "pan_check_failure", "Purva query form had no CSRF token", {
          meta: { clientId, registrar: this.name },
        });
        return {
          pan: normalizedPan,
          status: "error",
          error: "Registrar returned an unrecognized response format.",
        };
      }

      // Step 2: submit the PAN query in the same session.
      const response = await withRetry(() =>
        this.http.post<string>(
          `${PURVA_BASE_URL}${PURVA_QUERY_PATH}`,
          new URLSearchParams({
            csrfmiddlewaretoken: csrfToken,
            company_id: clientId,
            applicationNumber: "",
            panNumber: normalizedPan,
          }).toString(),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              ...(cookies ? { Cookie: cookies } : {}),
              Referer: `${PURVA_BASE_URL}${PURVA_QUERY_PATH}`,
            },
          }
        )
      );

      const html = response.data ?? "";
      const text = stripTags(html);

      log("info", "api_response_time", "Purva PAN query completed", {
        durationMs: Date.now() - started,
        meta: { clientId, registrar: this.name },
      });

      if (NOT_FOUND_PATTERNS.test(text)) {
        return { pan: normalizedPan, status: "not_found" };
      }

      // Look for a result table with share counts, keyword-anchored so a
      // markup reshuffle surfaces as an error instead of a wrong verdict.
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
          const rowText = cells.join(" ");
          if (/name/i.test(rowText) && !name) {
            const candidate = cells[cells.length - 1];
            if (candidate && !/name/i.test(candidate)) name = candidate;
          }
          if (/allot/i.test(rowText) && allotted === undefined) {
            const n = rowText.match(/(\d[\d,]*)/);
            if (n) allotted = Number(n[1].replace(/,/g, ""));
          } else if (/appl/i.test(rowText) && applied === undefined) {
            const n = rowText.match(/(\d[\d,]*)/);
            if (n) applied = Number(n[1].replace(/,/g, ""));
          }
        }
      }

      if (tables.length === 0) {
        log("warn", "pan_check_failure", "Purva response had no result table", {
          meta: { clientId, registrar: this.name },
        });
        return {
          pan: normalizedPan,
          status: "error",
          error: "Registrar returned an unrecognized response format.",
        };
      }

      const allottedShares = allotted ?? 0;
      return {
        pan: normalizedPan,
        name,
        appliedShares: applied,
        allottedShares,
        status: allottedShares > 0 ? "allotted" : "not_allotted",
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string };

      log("error", "pan_check_failure", `Purva PAN check failed: ${err.message ?? "unknown"}`, {
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

export const purvaAdapter = new PurvaAdapter();
