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

  constructor() {
    this.http = axios.create({
      // Keep well inside serverless function budgets; mirrors are tried in
      // series so every second here multiplies on unreachable networks.
      timeout: 12000,
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

  async checkAllotment(
    pan: string,
    clientId: string,
    preSolvedCaptcha?: { token: string; answer: string }
  ): Promise<AllotmentResult> {
    const normalizedPan = pan.toUpperCase().trim();
    const started = Date.now();
    let lastError: unknown = null;

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
            3,
            500
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
          log("warn", "pan_check_failure", `Bigshare check failed on mirror ${mirror}: ${errorMessage(error)}`);
          const httpStatus = (error as { response?: { status?: number } }).response?.status;
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
          // A definitive 4xx (bad request, forbidden) will fail on every mirror
          // the same way — don't burn the retry budget on the remaining ones.
          if (httpStatus && httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429) break;
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
    if (pans.length === 0) return [];

    // ── Speed strategy (two-pronged) ─────────────────────────────────────────
    //
    // 1. TOKEN SHARING: one OCR solve is shared across ALL PANs in this bulk
    //    run. Many bulk uploads go to the same IPO with the same session-bound
    //    CAPTCHA; if Bigshare doesn't single-use-invalidate the token we get
    //    the entire bulk for the price of one OCR call (~3s total vs n×3s).
    //    On Status:"CAPTCHA" rejection the shared token is refreshed once and
    //    sharing continues — a single bad OCR read doesn't abort the whole run.
    //
    // 2. DOUBLE-BUFFER POOL: pre-solve chunkSize*2 tokens so the NEXT chunk's
    //    captchas are ready while the CURRENT chunk is posting. Refills are
    //    triggered at chunk-start (not just per-token-consume) so OCR latency
    //    (~3s) is hidden behind POST latency (~1-2s per chunk).
    // ─────────────────────────────────────────────────────────────────────────

    const CHUNK_SIZE = 5;
    // Double-buffer: keep 2× a full chunk pre-solved so next chunk is ready
    // before current chunk finishes posting.
    const POOL_TARGET = CHUNK_SIZE * 2;

    // ── Shared captcha token ─────────────────────────────────────────────────
    // All PANs attempt to reuse the same token. On rejection we refresh once.
    let sharedCaptcha: { token: string; answer: string; capturedAt: number } | null = null;
    let sharedCaptchaRefreshing = false;

    const getOrRefreshShared = async (): Promise<{ token: string; answer: string } | null> => {
      if (
        sharedCaptcha &&
        Date.now() - sharedCaptcha.capturedAt < CAPTCHA_TOKEN_VALIDITY_MS
      ) {
        return { token: sharedCaptcha.token, answer: sharedCaptcha.answer };
      }
      if (sharedCaptchaRefreshing) return null; // pool fallback will handle it
      sharedCaptchaRefreshing = true;
      try {
        const cf = await this.fetchCaptchaToken();
        sharedCaptcha = { ...cf, capturedAt: Date.now() };
        return { token: cf.token, answer: cf.answer };
      } catch {
        return null;
      } finally {
        sharedCaptchaRefreshing = false;
      }
    };

    // Invalidate the shared token when a PAN reports CAPTCHA rejection so the
    // next caller triggers a fresh solve. Called from checkAllotment indirectly
    // via the preSolvedCaptcha param: when the server rejects the answer it
    // retries internally with a freshly fetched token, so we just need to
    // expire the shared one here so subsequent PANs get the new solve.
    const invalidateShared = () => { sharedCaptcha = null; };

    // ── Double-buffer pool ───────────────────────────────────────────────────
    interface PooledCaptcha { token: string; answer: string; capturedAt: number }
    const pool: PooledCaptcha[] = [];
    let poolRefillInFlight = 0;

    const refillPool = () => {
      const deficit = POOL_TARGET - pool.length - poolRefillInFlight;
      for (let i = 0; i < deficit; i++) {
        poolRefillInFlight++;
        this.fetchCaptchaToken()
          .then((captcha) => {
            pool.push({ ...captcha, capturedAt: Date.now() });
          })
          .catch(() => { /* pool just has one fewer slot; per-PAN fallback handles it */ })
          .finally(() => { poolRefillInFlight--; });
      }
    };

    // ── Initial pre-warm ─────────────────────────────────────────────────────
    // Fetch the shared token + a full double-buffer pool simultaneously so the
    // first chunk starts with zero captcha wait time.
    const prewarmCount = Math.min(pans.length, POOL_TARGET);
    const [sharedResult, ...poolResults] = await Promise.allSettled([
      this.fetchCaptchaToken(),
      ...Array.from({ length: prewarmCount }, () => this.fetchCaptchaToken()),
    ]);

    const capturedAt = Date.now();
    if (sharedResult.status === "fulfilled") {
      sharedCaptcha = { ...sharedResult.value, capturedAt };
    }
    for (const w of poolResults) {
      if (w.status === "fulfilled") pool.push({ ...w.value, capturedAt });
    }

    // ── Token picker: shared first, pool fallback ─────────────────────────────
    const pickCaptcha = async (): Promise<{ token: string; answer: string } | undefined> => {
      // Try the shared token first (zero extra OCR cost).
      const shared = await getOrRefreshShared();
      if (shared) return shared;

      // Shared unavailable (refreshing) — drain the pool.
      while (pool.length > 0) {
        const candidate = pool.shift()!;
        if (Date.now() - candidate.capturedAt < CAPTCHA_TOKEN_VALIDITY_MS) {
          refillPool(); // maintain double-buffer
          return { token: candidate.token, answer: candidate.answer };
        }
        log("warn", "pan_check_failure", "Discarded stale pre-warmed CAPTCHA token", {
          meta: { registrar: this.name },
        });
      }

      log("warn", "pan_check_failure", "CAPTCHA pool empty; falling back to per-PAN solve", {
        meta: { registrar: this.name, poolRefillInFlight },
      });
      refillPool();
      return undefined; // checkAllotment will solve its own
    };

    // Wrap checkAllotment to intercept CAPTCHA rejections and expire the shared
    // token so the next PAN gets a fresh one.
    const checkWithSharing = async (pan: string): Promise<AllotmentResult> => {
      const captcha = await pickCaptcha();
      const result = await this.checkAllotment(pan, clientId, captcha);
      // If the result is a CAPTCHA error, the shared token was bad — expire it.
      if (
        result.status === "error" &&
        typeof result.error === "string" &&
        /captcha/i.test(result.error)
      ) {
        invalidateShared();
      }
      return result;
    };

    return bulkCheck(
      pans,
      checkWithSharing,
      {
        // 5 concurrent checks: matches POOL_TARGET/2 so double-buffer always has
        // the next chunk ready. Higher than 5 risks OCR.Space 429 under bulk load.
        chunkSize: CHUNK_SIZE,
        // Minimal inter-chunk pause — double-buffer means tokens are pre-solved;
        // the 150ms just avoids Bigshare server-side burst detection.
        chunkDelayMs: 150,
      }
    );
  }
}

export const bigShareAdapter = new BigShareAdapter();