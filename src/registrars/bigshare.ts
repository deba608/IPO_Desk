// src/registrars/bigshare.ts
// Bigshare Services Registrar Adapter — Live
//
// Integration research:
//   - IPO list:  the dropdown on https://ipo.bigshareonline.com/IPO_Status.html
//                is rendered server-side as inline <option value="ID"> tags
//                (retired IPOs are commented out — comments must be stripped).
//                No JSON list endpoint exists.
//   - Allotment: POST https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails
//                body {Applicationno, Company, SelectionType:"PN", PanNo,
//                      txtcsdl, txtDPID, txtClId, ddlType, lang}
//                → {"d": {APPLICATION_NO, DPID, Name, APPLIED, ALLOTED, Status, ...}}
//                Status field: "OK", "NOTFOUND" (server may also return "CAPTCHA")
//                DPID === "No data found" means PAN not found for that issue.
//
// Notes (issue #7): the server-side CAPTCHA flow (Captcha.ashx + OCR solve +
// CaptchaToken/CaptchaAnswer/ResultToken) was removed because it produced
// wrong/failed results on bulk PAN checks. Requests are now sent without a
// CAPTCHA token. If Bigshare requires a CAPTCHA again, checks surface a clear
// error instead of silently returning wrong results.

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

/** Upstream 429 cooldown — mirrors share one rate-limit pool, so back off. */
const BIGSHARE_429_COOLDOWN_MS = 60_000;

/** Only server errors are worth retrying; 429/400 fail fast so the cooldown
 *  can arm and the caller can back off instead of hammering a rate-limited pool. */
const BIGSHARE_RETRYABLE = [500, 502, 503, 504];

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

/** Retry only 5xx responses; 4xx (incl. 429) fail fast. */
async function retryServerError<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown = new Error("Retry failed");
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === undefined || !BIGSHARE_RETRYABLE.includes(status)) throw error;
      if (i === attempts - 1) throw error;
    }
  }
  throw lastError;
}

export class BigShareAdapter implements RegistrarAdapter {
  readonly name = "bigshare";
  readonly displayName = "Bigshare Services Pvt. Ltd.";

  private readonly http: AxiosInstance;

  /** Epoch ms until which Bigshare calls short-circuit (upstream 429). */
  private rateLimitedUntil = 0;

  private rateLimitRetryAfterSec(): number {
    return Math.max(1, Math.ceil((this.rateLimitedUntil - Date.now()) / 1000));
  }

  public isUpstreamRateLimited(): boolean {
    return Date.now() < this.rateLimitedUntil;
  }

  public rateLimitRetryAfterSecPublic(): number {
    return this.rateLimitRetryAfterSec();
  }

  private noteUpstreamRateLimited(): void {
    this.rateLimitedUntil = Date.now() + BIGSHARE_429_COOLDOWN_MS;
    log("warn", "pan_check_failure", "Bigshare upstream 429 — cooling down 60s", {
      meta: { registrar: this.name },
    });
  }

  constructor() {
    this.http = axios.create({
      timeout: 12000,
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
          await withRetry(() => this.http.get<string>(`https://${mirror}/IPO_Status.html`), 3, 800)
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

    // Upstream 429 cooldown: short-circuit without burning POST calls.
    if (this.isUpstreamRateLimited()) {
      return {
        pan: normalizedPan,
        status: "error",
        error: `Rate limit exceeded. Please wait ~${this.rateLimitRetryAfterSecPublic()}s before retrying.`,
      };
    }

    const body = {
      Applicationno: "",
      Company: clientId,
      SelectionType: "PN", // PN = search by PAN
      PanNo: normalizedPan,
      txtcsdl: "",
      txtDPID: "",
      txtClId: "",
      ddlType: "",
      lang: "en",
      // No CAPTCHA token is sent (see file header — issue #7).
    };

    for (const mirror of BIGSHARE_MIRRORS) {
      try {
        const response = await retryServerError(() =>
          this.http.post<BigShareCheckResponse>(
            `https://${mirror}/Data.aspx/FetchIpodetails`,
            body,
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

        // Handle the server-side CAPTCHA status: we do not solve CAPTCHA, so
        // surface it as a clear error rather than guessing the outcome.
        const status = (record as { Status?: string }).Status;
        if (status === "CAPTCHA") {
          return {
            pan: normalizedPan,
            status: "error",
            error: "Bigshare requires CAPTCHA verification — please try again later.",
          };
        }

        if (
          status === "NOTFOUND" ||
          status === "NO_RECORD" ||
          status === "NO_DATA" ||
          status === "NODATA"
        ) {
          return { pan: normalizedPan, status: "not_found" };
        }

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

        // A schema shift (completely missing/renamed fields) must surface as an error.
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

        // All data fields empty — PAN was not applied to this issue.
        if (!record.DPID && !record.ALLOTED && !record.APPLIED) {
          return { pan: normalizedPan, status: "not_found" };
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
        const httpStatus = (error as { response?: { status?: number } }).response?.status;
        log("warn", "pan_check_failure", `Bigshare check failed on mirror ${mirror}: ${errorMessage(error)}`, {
          meta: { clientId, registrar: this.name, mirror, httpStatus: httpStatus ?? "none" },
        });
        // Upstream 429: arm the cooldown so the rest of the batch short-circuits.
        if (httpStatus === 429) {
          this.noteUpstreamRateLimited();
          break;
        }
        // A definitive 4xx will fail on every mirror the same way — break
        // immediately. Mirrors share one rate-limit pool.
        if (httpStatus && httpStatus >= 400 && httpStatus < 500) break;
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
      return {
        pan: normalizedPan,
        status: "error",
        error: "Network error on Bigshare servers. Please try again.",
      };
    }
    if (err?.response?.status === 429) {
      this.noteUpstreamRateLimited();
      return {
        pan: normalizedPan,
        status: "error",
        error: `Rate limit exceeded. Please wait ~${this.rateLimitRetryAfterSecPublic()}s before retrying.`,
      };
    }
    return {
      pan: normalizedPan,
      status: "error",
      error: `API error: ${err.response.status ?? err.message}`,
    };
  }

  async checkBulkAllotment(pans: string[], clientId: string): Promise<AllotmentResult[]> {
    if (pans.length === 0) return [];

    // Upstream 429 cooldown: fail the whole batch fast with retry hint.
    if (this.isUpstreamRateLimited()) {
      const retryAfter = this.rateLimitRetryAfterSecPublic();
      return pans.map((pan) => ({
        pan: pan.toUpperCase().trim(),
        status: "error" as const,
        error: `Rate limit exceeded. Please wait ~${retryAfter}s before retrying.`,
      }));
    }

    return bulkCheck(pans, (pan) => this.checkAllotment(pan, clientId));
  }
}

export const bigShareAdapter = new BigShareAdapter();

/** Health/ops: is Bigshare in upstream-429 cooldown on this instance? */
export function isBigshareRateLimited(): boolean {
  return bigShareAdapter.isUpstreamRateLimited();
}

/** Health/ops: seconds until Bigshare cooldown lifts (0 when not limited). */
export function getBigshareRetryAfterSec(): number {
  return bigShareAdapter.rateLimitRetryAfterSecPublic();
}
