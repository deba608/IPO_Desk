// src/registrars/bigshare.ts
// Bigshare Services Registrar Adapter — Live with server-side CAPTCHA support
//
// Integration research (verified 2026-09-01):
//   - IPO list:  the dropdown on https://ipo.bigshareonline.com/IPO_Status.html
//                is rendered server-side as inline <option value="ID"> tags
//                (retired IPOs are commented out — comments must be stripped).
//                Priority 3 (HTML response parsing); no JSON list endpoint exists.
//   - Allotment: POST https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails
//                body {Applicationno, Company, SelectionType:"PN", PanNo, ...,
//                      CaptchaToken, CaptchaAnswer, ResultToken}
//                → {"d": {APPLICATION_NO, DPID, Name, APPLIED, ALLOTED, Status, ...}}
//                Status field: "OK", "NOTFOUND", "CAPTCHA" — new since server-side CAPTCHA upgrade
//                DPID === "No data found" means PAN not found for that issue.
//                Priority 2 (AJAX endpoint integration) — now requires CAPTCHA token
//                CAPTCHA flow: GET Captcha.ashx → {token, image} → solve via OCR → POST with token+answer
//                The page CAPTCHA is now generated and validated server-side.
//                No authentication or session cookies required, but CAPTCHA answer must be supplied.

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult, BigShareCheckResponse } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { log } from "@/services/logger.service";
import { solveBigShareCaptcha } from "@/services/captcha.service";
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

  /** Fetch a fresh CAPTCHA token and solved answer from the captcha service. */
  async fetchCaptchaToken(): Promise<{ token: string; answer: string }> {
    return solveBigShareCaptcha();
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

    // Fetch a fresh CAPTCHA token + solved answer once per checkAllotment call
    let captchaToken: string;
    let captchaAnswer: string;
    try {
      const cf = await this.fetchCaptchaToken();
      captchaToken = cf.token;
      captchaAnswer = cf.answer;
    } catch {
      log("error", "pan_check_failure", "Failed to fetch CAPTCHA token", {
        meta: { clientId, registrar: this.name },
      });
      return {
        pan: normalizedPan,
        status: "error",
        error: "Could not obtain CAPTCHA token. Please try again.",
      };
    }

    for (const mirror of BIGSHARE_MIRRORS) {
      // Retry once per mirror with a fresh CAPTCHA if the answer is rejected.
      for (let attempt = 0; attempt < 2; attempt++) {
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
                // New: server-side CAPTCHA requirements
                CaptchaToken: captchaToken,
                CaptchaAnswer: captchaAnswer,
                ResultToken: "",
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

          // Handle new Status field from server-side CAPTCHA upgrade
          const status = record.Status;
          if (status === "CAPTCHA") {
            // Captcha answer was invalid; refresh and retry once on the same mirror.
            if (attempt === 0) {
              log("warn", "pan_check_failure", "Bigshare CAPTCHA invalid, refreshing", {
                meta: { clientId, registrar: this.name, mirror },
              });
              try {
                const cf2 = await this.fetchCaptchaToken();
                captchaToken = cf2.token;
                captchaAnswer = cf2.answer;
                continue;
              } catch {
                log("error", "pan_check_failure", "Failed to refresh CAPTCHA", {
                  meta: { clientId, registrar: this.name },
                });
                return {
                  pan: normalizedPan,
                  status: "error",
                  error: "CAPTCHA verification failed. Please try again.",
                };
              }
            }
            // Second invalid CAPTCHA on the same mirror — fall through to next mirror.
            throw new Error("CAPTCHA rejected on retry");
          }

          if (status === "NOTFOUND" || status === "NO_RECORD") {
            return { pan: normalizedPan, status: "not_found" };
          }
          // status === "OK" or undefined - continue to parse fields

          // Bigshare sentinel messages indicating no application was filed with this PAN
          if (
            (typeof record.DPID === "string" &&
              (/please enter valid/i.test(record.DPID) ||
                /no\s*data|no\s*record|not\s*found|invalid/i.test(record.DPID))) ||
            (typeof record.Name === "string" &&
              /no\s*data|no\s*record|not\s*found|not\s*applied/i.test(record.Name)) ||
            (typeof record.APPLICATION_NO === "string" &&
              /no\s*data|no\s*record|not\s*found/i.test(record.APPLICATION_NO))
          ) {
            return { pan: normalizedPan, status: "not_found" };
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

          const allottedShares = toCount(record.ALLOTED) ?? 0;
          const applied = toCount(record.APPLIED);

          return {
            pan: normalizedPan,
            name: record.Name || undefined,
            appliedShares: applied ?? undefined,
            allottedShares,
            status: allottedShares > 0 ? "allotted" : "not_allotted",
          };
        } catch (error: unknown) {
          lastError = error;
          log("warn", "pan_check_failure", `Bigshare check failed on mirror ${mirror}: ${errorMessage(error)}`);
          // A definitive 4xx (bad request, forbidden) will fail on every mirror
          // the same way — don't burn the retry budget on the remaining ones.
          const status = (error as { response?: { status?: number } }).response?.status;
          if (status && status >= 400 && status < 500 && status !== 429) break;
          // A CAPTCHA rejection isn't worth retrying further on this mirror.
          if (errorMessage(error).includes("CAPTCHA")) break;
        }
      }
    }

    const err = lastError as { response?: { status?: number; data?: unknown }; message?: string };

    log("error", "pan_check_failure", `All Bigshare mirrors failed: ${err?.message ?? "unknown"}`, {
      durationMs: Date.now() - started,
      meta: { clientId, registrar: this.name, httpStatus: err?.response?.status ?? "none" },
    });

    if (
      err?.response?.status === 404 ||
      (err?.response?.data &&
        /no\s*record|not\s*found|not\s*applied/i.test(JSON.stringify(err.response.data)))
    ) {
      return { pan: normalizedPan, status: "not_found" };
    }

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