// src/registrars/shared.ts
// Shared utilities for registrar adapters: retry with exponential backoff,
// chunked bulk execution (rate-limit protection), and XML helpers for the
// ASP.NET WebMethod responses several registrars return.

import { AllotmentResult } from "@/types/allotment.types";

export const BULK_CHUNK_SIZE = 5; // max simultaneous requests per registrar
export const BULK_CHUNK_DELAY_MS = 500;

export const PAN_FORMAT = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 4,
  startingDelayMs = 1500
): Promise<T> {
  let delayMs = startingDelayMs;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response
        ?.status;
      const isRetryable =
        status !== undefined && [429, 500, 502, 503, 504].includes(status);

      if (i === attempts - 1 || !isRetryable) throw error;

      await delay(delayMs + Math.random() * delayMs);
      delayMs *= 2;
    }
  }
  throw new Error("Max retries exceeded");
}

export interface BulkCheckOptions {
  /** Max simultaneous checks per chunk. Higher = faster but more upstream load. */
  chunkSize?: number;
  /** Pause between chunks so bursts don't trip registrar rate limits. */
  chunkDelayMs?: number;
}

/**
 * Run single-PAN checks in rate-limited chunks. Shared by all adapters so
 * bulk behaviour (concurrency, error isolation) is identical regardless of
 * registrar. Adapters with slow per-PAN work (e.g. Bigshare's CAPTCHA solve)
 * pass a larger chunkSize to keep bulk uploads fast.
 */
export async function bulkCheck(
  pans: string[],
  check: (pan: string) => Promise<AllotmentResult>,
  opts?: BulkCheckOptions
): Promise<AllotmentResult[]> {
  const chunkSize = opts?.chunkSize ?? BULK_CHUNK_SIZE;
  const chunkDelayMs = opts?.chunkDelayMs ?? BULK_CHUNK_DELAY_MS;
  const results: AllotmentResult[] = [];

  // Never forward malformed PANs to registrar endpoints — the adapter
  // interface promises validated PANs, and garbage input wastes upstream
  // requests or produces misleading "not found" results.
  const validPans = pans.filter((pan) => {
    if (PAN_FORMAT.test(pan)) return true;
    results.push({ pan, status: "error", error: "Invalid PAN format" });
    return false;
  });

  const batches = chunk(validPans, chunkSize);

  for (let b = 0; b < batches.length; b++) {
    const settled = await Promise.allSettled(batches[b].map((pan) => check(pan)));

    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          pan: batches[b][i],
          status: "error",
          error:
            result.reason instanceof Error
              ? result.reason.message
              : "Unknown error",
        });
      }
    });

    if (b < batches.length - 1) {
      await delay(chunkDelayMs);
    }
  }

  return results;
}

/**
 * Parse the `<NewDataSet><Table>…</Table></NewDataSet>` XML that ASP.NET
 * WebMethods (MUFG Intime) return inside the JSON `d` property. Returns one
 * record per <Table>, mapping tag name → text content.
 */
export function parseNewDataSetTables(xml: string): Record<string, string>[] {
  const records: Record<string, string>[] = [];
  const tableRe = /<Table\b[^>]*>([\s\S]*?)<\/Table>/g;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRe.exec(xml)) !== null) {
    const record: Record<string, string> = {};
    const fieldRe = /<([A-Za-z_][\w.]*)\s*>([\s\S]*?)<\/\1>/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRe.exec(tableMatch[1])) !== null) {
      record[fieldMatch[1]] = decodeXmlEntities(fieldMatch[2].trim());
    }
    records.push(record);
  }

  return records;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Find the first value in a record whose key matches the pattern. */
export function findField(
  record: Record<string, string>,
  pattern: RegExp
): string | undefined {
  const key = Object.keys(record).find((k) => pattern.test(k));
  return key !== undefined ? record[key] : undefined;
}
