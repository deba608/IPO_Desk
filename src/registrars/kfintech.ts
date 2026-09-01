// src/registrars/kfintech.ts
// KFintech Registrar Adapter — Live Implementation
// API: https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=pan

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult, KFinTechResponse } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { getActiveIPOs as getSyncedIPOs } from "@/services/kfintech-sync";
import { log } from "@/services/logger.service";
import { bulkCheck, delay } from "./shared";

const KFINTECH_BASE_URL =
  "https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=";

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 5,
  delayMs = 2000
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; code?: string };
      const status = err.response?.status;
      // Retry rate-limit/server errors plus pure network failures
      // (timeouts, ECONNRESET have no response object).
      const isRetryable =
        status === undefined ||
        [429, 500, 502, 503, 504].includes(status);

      if (i === attempts - 1 || !isRetryable) throw error;

      await delay(delayMs + Math.random() * delayMs);
      delayMs *= 2;
    }
  }
  throw new Error("Max retries exceeded");
}

export class KFinTechAdapter implements RegistrarAdapter {
  readonly name = "kfintech";
  readonly displayName = "KFintech Computershare";

  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async getActiveIPOs(): Promise<IPO[]> {
    // Dynamic discovery lives in the sync service (5-minute cache, snapshot
    // fallback, sync logging) — see src/services/kfintech-sync.ts
    return getSyncedIPOs();
  }

  async checkAllotment(pan: string, clientId: string): Promise<AllotmentResult> {
    const normalizedPan = pan.toUpperCase().trim();
    const started = Date.now();
    try {
      // Axios throws on non-2xx by default, so success here means HTTP 200.
      const response = await withRetry(() =>
        this.http.get<KFinTechResponse>(KFINTECH_BASE_URL + "pan", {
          headers: {
            reqparam: normalizedPan,
            client_id: `${clientId}`,
          },
        })
      );

      const records = response.data?.data;
      if (!records || records.length === 0) {
        return {
          pan: normalizedPan,
          status: "not_found",
        };
      }

      const record = records[0];

      // Check if record contains sentinel not applied / no record message
      const recordText = `${record.Name || ""} ${record.Pan_No || ""}`.trim();
      if (/no\s*record|not\s*found|not\s*applied|no\s*data/i.test(recordText)) {
        return {
          pan: normalizedPan,
          status: "not_found",
        };
      }

      const allottedShares = Number(record.All_Shares);
      const appliedShares = Number(record.App_Shares);

      // If share counts are missing or empty string and name is not provided, treat as not_found
      if (!record.All_Shares && !record.App_Shares && !record.Name) {
        return {
          pan: normalizedPan,
          status: "not_found",
        };
      }

      // A missing/garbage share count when a name is present must surface as an error
      if (!Number.isFinite(allottedShares)) {
        log("warn", "pan_check_failure", "KFintech response had unusable share counts", {
          durationMs: Date.now() - started,
          meta: { clientId, keys: Object.keys(record).join(",") },
        });
        return {
          pan: normalizedPan,
          name: record.Name,
          status: "error",
          error: "Registrar returned an unrecognized response format.",
        };
      }

      log("info", "api_response_time", "KFintech PAN query completed", {
        durationMs: Date.now() - started,
        meta: { clientId },
      });

      return {
        pan: record.Pan_No || normalizedPan,
        name: record.Name,
        appliedShares: Number.isFinite(appliedShares) ? appliedShares : undefined,
        allottedShares,
        status: allottedShares > 0 ? "allotted" : "not_allotted",
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown }; message?: string };

      log("error", "pan_check_failure", `PAN check failed: ${err.message ?? "unknown"}`, {
        durationMs: Date.now() - started,
        meta: { clientId, httpStatus: err.response?.status ?? "none" },
      });

      if (
        err.response?.status === 404 ||
        (err.response?.data &&
          /no\s*record|not\s*found|not\s*applied/i.test(JSON.stringify(err.response.data)))
      ) {
        return {
          pan: normalizedPan,
          status: "not_found",
        };
      }

      if (!err.response) {
        // Network error
        return {
          pan: normalizedPan,
          status: "error",
          error: "Network error. Please try again.",
        };
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

  async checkBulkAllotment(
    pans: string[],
    clientId: string
  ): Promise<AllotmentResult[]> {
    // Shared implementation keeps chunking/rate-limit behaviour identical
    // across adapters and attributes failures to the right PAN.
    return bulkCheck(pans, (pan) => this.checkAllotment(pan, clientId));
  }
}

// Singleton export
export const kfinTechAdapter = new KFinTechAdapter();
