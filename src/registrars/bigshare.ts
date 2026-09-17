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

/** Conservative validity window — Bigshare tokens are valid for ~60 s. */
const CAPTCHA_TOKEN_VALIDITY_MS = 45_000;

/** Upstream 429 cooldown — mirrors share one rate-limit pool, so back off. */
const BIGSHARE_429_COOLDOWN_MS = 60_000;

/** Retry only server errors for Bigshare — never 429/400 (fail fast). */
const BIGSHARE_RETRYABLE = [500, 502, 503, 504];

/**
 * Per-PAN deadline so one slow CAPTCHA/POST can't poison a 10-PAN sequential
 * batch into the 50s /api/check timeout. Slow PAN becomes one error row;
 * the rest of the batch still completes. 12s covers a shared-miss solve
 * (~6s fetch) + POST (~8s) worst-serial case with margin.
 */
const PER_PAN_TIMEOUT_MS = 12_000;

function withPerPanTimeout<T>(promise: Promise<T>, pan: string): Promise<T> {
  promise.catch(() => {});
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Bigshare check timed out for ${pan} — please retry this PAN.`)),
      PER_PAN_TIMEOUT_MS
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Turn a raw CAPTCHA-stage failure into a user-actionable message. The three
 * causes need three different fixes (network egress vs OCR quota vs retry),
 * so they must not all surface as the same generic error.
 */
function classifyCaptchaFailure(raw: string): string {
  if (
    /timeout|timed out|ENOTFOUND|ECONNRESET|ECONNREFUSED|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|socket hang up|incomplete response|HTTP \d{3}|failed to fetch|fetch failed/i.test(
      raw
    )
  ) {
    return "Bigshare servers are unreachable from our servers right now. Please try again in a few minutes.";
  }
  if (/rate limit|429/i.test(raw)) {
    return "Too many checks at once — please wait a minute and retry.";
  }
  return "CAPTCHA solving failed. Please try again.";
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

  /**
   * Sticky fastest-mirror: once a mirror answers successfully it is tried
   * first for subsequent PANs, so a dead/slow mirror costs one penalty per
   * process lifetime instead of once per PAN in every bulk upload.
   */
  private fastestMirror: string | null = null;

  /** Mirrors with the last-known-good one first. */
  private orderedMirrors(): string[] {
    if (!this.fastestMirror) return BIGSHARE_MIRRORS;
    return [
      this.fastestMirror,
      ...BIGSHARE_MIRRORS.filter((m) => m !== this.fastestMirror),
    ];
  }

  /** Epoch ms until which Bigshare calls short-circuit (upstream 429). */
  private rateLimitedUntil = 0;

  private rateLimitRetryAfterSec(): number {
    return Math.max(1, Math.ceil((this.rateLimitedUntil - Date.now()) / 1000));
  }

  private isUpstreamRateLimited(): boolean {
    return Date.now() < this.rateLimitedUntil;
  }

  private noteUpstreamRateLimited(mirror?: string): void {
    this.rateLimitedUntil = Date.now() + BIGSHARE_429_COOLDOWN_MS;
    log("warn", "pan_check_failure", "Bigshare upstream 429 — cooling down 60s", {
      meta: { registrar: this.name, mirror: mirror ?? "unknown" },
    });
  }

  constructor() {
    this.http = axios.create({
      // Keep well inside serverless function budgets; mirrors are tried in
      // series so every second here multiplies on unreachable networks.
      // 8s (was 12s): 10-PAN sequential batches must fit the 50s /api/check budget.
      timeout: 8000,
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
          await withRetry(
            () => this.http.get<string>(`https://${mirror}/IPO_Status.html`),
            // Fail fast on 429 (shared pool) — default 4x1500ms wastes ~10s per mirror.
            2,
            500,
            BIGSHARE_RETRYABLE
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

  async checkAllotment(
    pan: string,
    clientId: string,
    preSolvedCaptcha?: { token: string; answer: string }
  ): Promise<AllotmentResult> {
    const normalizedPan = pan.toUpperCase().trim();
    const started = Date.now();
    let lastError: unknown = null;

    // Upstream 429 cooldown: short-circuit without burning CAPTCHA/POST calls.
    if (this.isUpstreamRateLimited()) {
      return {
        pan: normalizedPan,
        status: "error",
        error: `Rate limit exceeded. Please wait ~${this.rateLimitRetryAfterSec()}s before retrying.`,
      };
    }

    // Bulk path can hand us a pre-warmed CAPTCHA so the allotment POST
    // starts immediately; otherwise fetch one (single-PAN path).
    let captchaToken: string;
    let captchaAnswer: string;
    if (preSolvedCaptcha) {
      captchaToken = preSolvedCaptcha.token;
      captchaAnswer = preSolvedCaptcha.answer;
    } else {
      try {
        const cf = await this.fetchCaptchaToken();
        captchaToken = cf.token;
        captchaAnswer = cf.answer;
      } catch (error: unknown) {
        const msg = errorMessage(error);
        log("error", "pan_check_failure", `Failed to fetch CAPTCHA token: ${msg}`, {
          meta: { clientId, registrar: this.name },
        });
        return {
          pan: normalizedPan,
          status: "error",
          error: classifyCaptchaFailure(msg),
        };
      }
    }

    for (const mirror of this.orderedMirrors()) {
      // Retry once per mirror with a fresh CAPTCHA if the answer is rejected.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          // Fail fast inside bulk: the mirror loop already gives 3 mirrors ×
          // 2 attempts of redundancy, so a long per-request retry budget here
          // just multiplies every PAN's latency on flaky networks.
          const response = await withRetry(
            () =>
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
              ),
            // 2 attempts max, server-errors only: 429/400 fail fast (shared
            // pool) instead of burning backoff before the mirror-loop break.
            2,
            500,
            BIGSHARE_RETRYABLE
          );

          // Remember the working mirror so the next PAN tries it first.
          this.fastestMirror = mirror;

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
            if (attempt === 0) {
              log("warn", "pan_check_failure", "Bigshare CAPTCHA invalid", {
                meta: { clientId, registrar: this.name, mirror },
              });
              // Bulk mode: a pre-solved captcha was supplied by checkWithSharing.
              // DO NOT re-solve internally — that would bypass the shared promise
              // deduplication and add 3s per PAN. Throw so checkWithSharing can
              // refresh the shared token (1 OCR call, deduped across all PANs).
              if (preSolvedCaptcha) {
                throw new Error("CAPTCHA rejected — shared token invalid");
              }
              // Single-PAN path: re-solve here.
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

          if (status === "NOTFOUND" || status === "NO_RECORD" || status === "NO_DATA" || status === "NODATA") {
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

          // A schema shift (completely missing/renamed fields) must surface as an
          // error so it is distinguishable from a legitimate "not applied" response.
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

          // All data fields are present but empty — PAN was not applied to this
          // issue. Returning not_allotted (0 shares) here would be misleading.
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
          // Upstream 429: arm the cooldown so the rest of the batch (and the
          // next minute of requests) short-circuit instead of hammering.
          if (httpStatus === 429) {
            this.noteUpstreamRateLimited(mirror);
          }
          // HTTP 400 may indicate a stale/invalid CAPTCHA token — Bigshare sometimes
          // rejects at the HTTP layer instead of via Status:"CAPTCHA" in the body.
          // Refresh the token before moving to the next mirror so a stale token
          // does not poison all remaining mirrors.
          if (httpStatus === 400 && attempt === 0) {
            try {
              const cf2 = await this.fetchCaptchaToken();
              captchaToken = cf2.token;
              captchaAnswer = cf2.answer;
            } catch { /* ignore; next mirror will fall back to per-PAN solve */ }
          }
          // A definitive 4xx will fail on every mirror the same way — break
          // immediately. IMPORTANT: include 429 here — Bigshare mirrors share
          // the same rate-limit pool, so trying mirror 2/3 on a 429 is futile
          // and burns the 50s function timeout budget.
          if (httpStatus && httpStatus >= 400 && httpStatus < 500) break;
          // A CAPTCHA rejection isn't worth retrying further on this mirror.
          if (errorMessage(error).includes("CAPTCHA")) break;
        }
      }
    }

    const err = lastError as { response?: { status?: number; data?: unknown }; message?: string; code?: string };

    log("error", "pan_check_failure", `All Bigshare mirrors failed: ${err?.message ?? "unknown"}`, {
      durationMs: Date.now() - started,
      meta: { clientId, registrar: this.name, httpStatus: err?.response?.status ?? "none", code: err?.code ?? "none" },
    });

    if (
      err?.response?.status === 404 ||
      (err?.response?.data &&
        /no\s*record|not\s*found|not\s*applied/i.test(JSON.stringify(err.response.data)))
    ) {
      return { pan: normalizedPan, status: "not_found" };
    }

    if (!err?.response) {
      const raw = `${err?.code ?? ""} ${err?.message ?? ""}`;
      if (/timeout|timed out|ECONNABORTED/i.test(raw)) {
        return { pan: normalizedPan, status: "error", error: "Bigshare timed out. Please retry this PAN." };
      }
      return { pan: normalizedPan, status: "error", error: "Network error on Bigshare servers. Please try again." };
    }
    if (err?.response?.status === 429) {
      this.noteUpstreamRateLimited();
      return {
        pan: normalizedPan,
        status: "error",
        error: `Rate limit exceeded. Please wait ~${this.rateLimitRetryAfterSec()}s before retrying.`,
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
      const retryAfter = this.rateLimitRetryAfterSec();
      log("warn", "pan_check_failure", `Bigshare bulk short-circuited (${pans.length} PANs, cooldown ~${retryAfter}s)`, {
        meta: { registrar: this.name, pans: pans.length },
      });
      return pans.map((pan) => ({
        pan: pan.toUpperCase().trim(),
        status: "error" as const,
        error: `Rate limit exceeded. Please wait ~${retryAfter}s before retrying.`,
      }));
    }

    // ── Strategy: token sharing + lazy pool ──────────────────────────────────
    //
    // Fetch exactly ONE captcha token upfront — no burst, no 429s.
    // Every PAN reuses that same token. If Bigshare doesn't single-use-
    // invalidate it the whole batch costs 1 OCR call total (~3s flat).
    // On rejection the shared token is refreshed; concurrent refreshes are
    // deduplicated via a shared Promise so 5 parallel PANs hitting an expired
    // token fire ONE re-solve, not 5. A tiny lazy pool (≤2 in-flight at a
    // time) covers the brief window while a refresh is in-progress.
    // ─────────────────────────────────────────────────────────────────────────

    const CHUNK_SIZE = 5;

    // ── Shared token ─────────────────────────────────────────────────────────
    let sharedCaptcha: { token: string; answer: string; capturedAt: number } | null = null;
    let refreshPromise: Promise<{ token: string; answer: string } | null> | null = null;

    const getOrRefreshShared = (): Promise<{ token: string; answer: string } | null> => {
      if (sharedCaptcha && Date.now() - sharedCaptcha.capturedAt < CAPTCHA_TOKEN_VALIDITY_MS) {
        return Promise.resolve({ token: sharedCaptcha.token, answer: sharedCaptcha.answer });
      }
      // Deduplicate: all concurrent callers await the same in-flight solve.
      if (!refreshPromise) {
        refreshPromise = this.fetchCaptchaToken()
          .then((cf) => {
            sharedCaptcha = { ...cf, capturedAt: Date.now() };
            return { token: cf.token, answer: cf.answer };
          })
          .catch(() => null)
          .finally(() => { refreshPromise = null; });
      }
      return refreshPromise;
    };

    const invalidateShared = () => { sharedCaptcha = null; };

    // ── Lazy fallback pool (≤1 in-flight) ────────────────────────────────────
    // Single bridge token only: with chunkSize 1 the shared refresh is rarely
    // contended, so a 2-deep pool just doubles Captcha.ashx burst on a miss.
    interface PooledCaptcha { token: string; answer: string; capturedAt: number }
    const pool: PooledCaptcha[] = [];
    let poolInFlight = 0;

    const maybeRefillPool = () => {
      while (pool.length + poolInFlight < 1 && poolInFlight < 1) {
        poolInFlight++;
        this.fetchCaptchaToken()
          .then((c) => { pool.push({ ...c, capturedAt: Date.now() }); })
          .catch(() => { /* fewer pool tokens; per-PAN fallback handles it */ })
          .finally(() => { poolInFlight--; });
      }
    };

    // ── Fetch the ONE shared token upfront (no burst) ─────────────────────────
    try {
      const cf = await this.fetchCaptchaToken();
      sharedCaptcha = { ...cf, capturedAt: Date.now() };
    } catch {
      log("warn", "pan_check_failure", "Initial shared CAPTCHA solve failed; will retry per-PAN", {
        meta: { registrar: this.name },
      });
    }

    // ── Token picker ─────────────────────────────────────────────────────────
    const pickCaptcha = async (): Promise<{ token: string; answer: string } | undefined> => {
      const shared = await getOrRefreshShared();
      if (shared) return shared;

      // Shared is refreshing — use a pooled token as a bridge.
      while (pool.length > 0) {
        const c = pool.shift()!;
        if (Date.now() - c.capturedAt < CAPTCHA_TOKEN_VALIDITY_MS) {
          maybeRefillPool();
          return { token: c.token, answer: c.answer };
        }
      }
      maybeRefillPool();
      return undefined; // checkAllotment falls back to its own per-PAN solve
    };

    // ── Wrapper: invalidate shared token on CAPTCHA rejection + retry once ─────
    // Whole per-PAN unit (pick + POST) races an 8s deadline so one stalled
    // PAN degrades to a single error row instead of pushing the batch into 504.
    const checkWithSharing = async (pan: string): Promise<AllotmentResult> => {
      const run = async (): Promise<AllotmentResult> => {
        const captcha = await pickCaptcha();
        try {
          const result = await this.checkAllotment(pan, clientId, captcha);
        // Surface-level CAPTCHA error (returned, not thrown) — expire shared token
        // so the next PAN triggers a fresh solve.
        if (
          result.status === "error" &&
          typeof result.error === "string" &&
          /captcha/i.test(result.error)
        ) {
          invalidateShared();
        }
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (/captcha/i.test(msg)) {
          // Shared token was rejected — invalidate and refresh via deduped promise
          // (all concurrent callers share one OCR re-solve, not one each).
          invalidateShared();
          const fresh = await getOrRefreshShared();
          // Retry once with fresh token; surface as error on second rejection.
          return this.checkAllotment(pan, clientId, fresh ?? undefined);
        }
        throw error;
      }
      };
      try {
        return await withPerPanTimeout(run(), pan);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Check failed";
        return { pan: pan.toUpperCase().trim(), status: "error" as const, error: msg };
      }
    };

    return bulkCheck(pans, checkWithSharing, {
      chunkSize: 1,
      // 300ms gap: sequential requests can't cause rate limits (no concurrency),
      // so 800ms was 2.7s wasted per 10 PANs. 300ms is enough for Bigshare
      // server-side anti-burst detection.
      chunkDelayMs: 300,
    });
  }
}

export const bigShareAdapter = new BigShareAdapter();

/** Health/ops: is Bigshare in upstream-429 cooldown on this instance? */
export function isBigshareRateLimited(): boolean {
  return (bigShareAdapter as unknown as { isUpstreamRateLimited: () => boolean }).isUpstreamRateLimited?.() ?? false;
}

/** Health/ops: seconds until Bigshare cooldown lifts (0 when not limited). */
export function getBigshareRetryAfterSec(): number {
  try {
    const v = (bigShareAdapter as unknown as { rateLimitRetryAfterSec: () => number }).rateLimitRetryAfterSec?.();
    return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
  } catch {
    return 0;
  }
}