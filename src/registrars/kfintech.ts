// src/registrars/kfintech.ts
// KFintech Registrar Adapter — Live Implementation
// API: https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=pan

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult, KFinTechResponse } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { KFINTECH_ACTIVE_IPOS } from "@/data/kfintech-ipos";

const KFINTECH_BASE_URL =
  "https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=";

const RETRY_CONFIG = {
  delayFirstAttempt: true,
  numOfAttempts: 5,
  startingDelay: 2000,
  timeMultiple: 2,
  jitter: "full" as const,
};

const CHUNK_SIZE = 10;
const CHUNK_DELAY_MS = 500;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = RETRY_CONFIG.numOfAttempts,
  delayMs = RETRY_CONFIG.startingDelay
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRetryable =
        error instanceof Error &&
        "response" in (error as { response?: { status?: number } }) &&
        [429, 500, 502, 504].includes(
          ((error as { response?: { status?: number } }).response?.status ?? 0)
        );

      if (i === attempts - 1 || !isRetryable) throw error;

      const jitter = Math.random() * delayMs;
      await delay(delayMs + jitter);
      delayMs *= RETRY_CONFIG.timeMultiple;
    }
  }
  throw new Error("Max retries exceeded");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
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
    // IPO list is sourced from the KFintech bundle (refreshed periodically)
    // Future: implement bundle scraper for real-time updates
    return KFINTECH_ACTIVE_IPOS;
  }

  async checkAllotment(pan: string, clientId: string): Promise<AllotmentResult> {
    try {
      const response = await withRetry(async () => {
        return this.http.get<KFinTechResponse>(KFINTECH_BASE_URL + "pan", {
          headers: {
            reqparam: pan.toUpperCase().trim(),
            client_id: `${clientId}`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      });

      if (response.status !== 200) {
        return {
          pan: pan.toUpperCase(),
          status: "error",
          error: `Unexpected response: ${response.status}`,
        };
      }

      const records = response.data?.data;
      if (!records || records.length === 0) {
        return {
          pan: pan.toUpperCase(),
          status: "not_found",
        };
      }

      const record = records[0];
      const allottedShares = Number(record.All_Shares);
      const appliedShares = Number(record.App_Shares);

      return {
        pan: record.Pan_No || pan.toUpperCase(),
        name: record.Name,
        appliedShares,
        allottedShares,
        status: allottedShares > 0 ? "allotted" : "not_allotted",
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string };
      
      if (!err.response) {
        // Network error
        return {
          pan: pan.toUpperCase(),
          status: "error",
          error: "Network error. Please try again.",
        };
      }

      if (err.response.status === 429) {
        return {
          pan: pan.toUpperCase(),
          status: "error",
          error: "Rate limit exceeded. Please wait before retrying.",
        };
      }

      return {
        pan: pan.toUpperCase(),
        status: "error",
        error: `API error: ${err.response.status ?? err.message}`,
      };
    }
  }

  async checkBulkAllotment(
    pans: string[],
    clientId: string
  ): Promise<AllotmentResult[]> {
    const results: AllotmentResult[] = [];
    const chunks = chunk(pans, CHUNK_SIZE);

    for (const chunkPans of chunks) {
      const chunkResults = await Promise.allSettled(
        chunkPans.map((pan) => this.checkAllotment(pan, clientId))
      );

      for (const result of chunkResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            pan: "UNKNOWN",
            status: "error",
            error: result.reason?.message ?? "Unknown error",
          });
        }
      }

      // Add delay between chunks to avoid rate limiting
      if (chunks.indexOf(chunkPans) < chunks.length - 1) {
        await delay(CHUNK_DELAY_MS);
      }
    }

    return results;
  }
}

// Singleton export
export const kfinTechAdapter = new KFinTechAdapter();
