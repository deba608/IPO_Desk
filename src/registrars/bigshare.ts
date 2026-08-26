// src/registrars/bigshare.ts
// Bigshare Services Registrar Adapter — Live
//
// Integration research (verified 2026-06-11):
//   - IPO list:  the dropdown on https://ipo.bigshareonline.com/IPO_Status.html
//                is rendered server-side as inline <option value="ID"> tags
//                (retired IPOs are commented out — comments must be stripped).
//                Priority 3 (HTML response parsing); no JSON list endpoint exists.
//   - Allotment: POST https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails
//                body {Applicationno, Company, SelectionType:"PN", PanNo,
//                      txtcsdl, txtDPID, txtClId, ddlType, lang}
//                → {"d": {APPLICATION_NO, DPID, Name, APPLIED, ALLOTED, …}}
//                DPID === "No data found" means PAN not found for that issue.
//                Priority 2 (AJAX endpoint integration).
//   - The page CAPTCHA is generated and validated entirely client-side; it is
//     never sent to the server. No authentication or session cookies required.

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult, BigShareCheckResponse } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { log } from "@/services/logger.service";
import { bulkCheck, withRetry } from "./shared";

const BIGSHARE_MIRRORS = [
  "ipo.bigshareonline.com",
  "ipo1.bigshareonline.com",
  "ipo2.bigshareonline.com",
];

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Coerce a share-count field of any type to a number; null when unusable. */
function toCount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

export class BigShareAdapter implements RegistrarAdapter {
  readonly name = "bigshare";
  readonly displayName = "Bigshare Services Pvt. Ltd.";

  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  }

  async getActiveIPOs(): Promise<IPO[]> {
    const started = Date.now();
    let lastError: unknown = null;

    for (const mirror of BIGSHARE_MIRRORS) {
      try {
        const html = (
          await withRetry(() =>
            this.http.get<string>(`https://${mirror}/IPO_Status.html`)
          )
        ).data;

        // Retired IPOs remain in the markup inside HTML comments — drop them first.
        const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");

        const selectMatch = withoutComments.match(
          /<select[^>]*id="ddlCompany"[^>]*>([\s\S]*?)<\/select>/i
        );
        if (!selectMatch) {
          throw new Error("Could not locate IPO dropdown on Bigshare status page");
        }

        const syncedAt = new Date().toISOString();
        const ipos: IPO[] = [];
        // Tolerate attribute order/extra attrs/whitespace variations in the
        // server-rendered <option> tags.
        const optionRe = /<option[^>]*\bvalue="(\d+)"[^>]*>([\s\S]*?)<\/option>/gi;
        let match: RegExpExecArray | null;
        while ((match = optionRe.exec(selectMatch[1])) !== null) {
          ipos.push({
            id: `${this.name}-${match[1]}`,
            clientId: match[1],
            name: stripTags(match[2]).trim(),
            registrar: "bigshare",
            status: "ACTIVE",
            lastSyncedAt: syncedAt,
          });
        }

        log("info", "ipo_sync_success", `Fetched ${ipos.length} active IPOs from Bigshare mirror ${mirror}`, {
          durationMs: Date.now() - started,
          meta: { count: ipos.length, registrar: this.name, mirror },
        });
        return ipos;
      } catch (error: unknown) {
        lastError = error;
        log("warn", "ipo_sync_fallback", `Bigshare mirror ${mirror} failed: ${errorMessage(error)}`);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(errorMessage(lastError) || "All Bigshare mirrors failed to fetch active IPOs");
  }

  async checkAllotment(pan: string, clientId: string): Promise<AllotmentResult> {
    const normalizedPan = pan.toUpperCase().trim();
    const started = Date.now();
    let lastError: unknown = null;

    for (const mirror of BIGSHARE_MIRRORS) {
      try {
        const response = await withRetry(() =>
          this.http.post<BigShareCheckResponse>(
            `https://${mirror}/Data.aspx/FetchIpodetails`,
            {
              Applicationno: "",
              Company: clientId,
              SelectionType: "PN", // PN = search by PAN
              PanNo: normalizedPan,
              txtcsdl: "",
              txtDPID: "",
              txtClId: "",
              ddlType: "",
              lang: "en",
            },
            { headers: { "Content-Type": "application/json; charset=utf-8" } }
          )
        );

        log("info", "api_response_time", `Bigshare PAN query completed via ${mirror}`, {
          durationMs: Date.now() - started,
          meta: { clientId, registrar: this.name, mirror },
        });

        const record = response.data?.d;
        if (!record) {
          throw new Error("Registrar returned an unrecognized response format.");
        }

        // A schema shift (missing/renamed fields) must surface as an error,
        // not fall through to a silent not_allotted.
        if (
          record.DPID === undefined &&
          record.ALLOTED === undefined &&
          record.APPLIED === undefined
        ) {
          log("warn", "pan_check_failure", "Bigshare response had unrecognized fields", {
            meta: { clientId, registrar: this.name, mirror, keys: Object.keys(record).join(",") },
          });
          return {
            pan: normalizedPan,
            status: "error",
            error: "Registrar returned an unrecognized response format.",
          };
        }

        if (
          typeof record.DPID === "string" &&
          /^no data found/i.test(record.DPID.trim())
        ) {
          return { pan: normalizedPan, status: "not_found" };
        }
        if (
          typeof record.DPID === "string" &&
          record.DPID.startsWith("Please Enter Valid")
        ) {
          return { pan: normalizedPan, status: "error", error: record.DPID };
        }

        const allottedShares = toCount(record.ALLOTED) ?? 0;
        const applied = toCount(record.APPLIED);

        return {
          pan: normalizedPan,
          name: record.Name || undefined,
          appliedShares: applied ?? undefined,
          allottedShares,
          status: allottedShares > 0 ? "allotted" : "not_allotted",
        };
      } catch (error) {
        lastError = error;
        log("warn", "pan_check_failure", `Bigshare check failed on mirror ${mirror}: ${errorMessage(error)}`);
        // A definitive 4xx (bad request, forbidden) will fail on every mirror
        // the same way — don't burn the retry budget on the remaining ones.
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status && status >= 400 && status < 500 && status !== 429) break;
      }
    }

    const err = lastError as { response?: { status?: number }; message?: string };

    log("error", "pan_check_failure", `All Bigshare mirrors failed: ${err?.message ?? "unknown"}`, {
      durationMs: Date.now() - started,
      meta: { clientId, registrar: this.name, httpStatus: err?.response?.status ?? "none" },
    });

    if (!err?.response) {
      return { pan: normalizedPan, status: "error", error: "Network error on Bigshare servers. Please try again." };
    }
    if (err?.response?.status === 429) {
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

  async checkBulkAllotment(pans: string[], clientId: string): Promise<AllotmentResult[]> {
    return bulkCheck(pans, (pan) => this.checkAllotment(pan, clientId));
  }
}

export const bigShareAdapter = new BigShareAdapter();
