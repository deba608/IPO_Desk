// src/registrars/shared.ts
// Shared utilities for registrar adapters: retry with exponential backoff,
// chunked bulk execution (rate-limit protection), cookie-jar sessions for
// Django/PHP form flows, and XML helpers for the ASP.NET WebMethod responses
// several registrars return.

import { AxiosInstance } from "axios";
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

/* ------------------------------------------------------------------ */
/*  Cookie-jar session for HTML form flows                              */
/* ------------------------------------------------------------------ */

export interface SessionResponse {
  status: number;
  data: string;
}

export interface SessionRequestOptions {
  headers?: Record<string, string>;
}

export interface CookieSession {
  get(url: string, opts?: SessionRequestOptions): Promise<SessionResponse>;
  post(
    url: string,
    body: string,
    opts?: SessionRequestOptions
  ): Promise<SessionResponse>;
}

/**
 * Cookie-jar session over an axios instance for Django/PHP form flows.
 *
 * Why this exists (Purva lesson, 2026-09-06): Django answers a form POST
 * with `302 + Set-Cookie: messages=... + Location: <same page>` and renders
 * the verdict ("No record found" banner / result table) only on the NEXT
 * GET. Axios follows the 302 internally but drops the intermediate
 * Set-Cookie, so the final page is a blank form — every check then fails
 * with "unrecognized response format". This session follows redirects
 * manually (maxRedirects: 0 + validateStatus) and replays the accumulated
 * jar on every hop, exactly like a browser / CookieJar client.
 *
 * Same-origin only by construction: adapters talk to one portal host.
 * POST → 301/302/303 becomes GET, matching browser behaviour.
 */
export function createCookieSession(
  http: AxiosInstance,
  maxRedirects = 5
): CookieSession {
  const jar = new Map<string, string>();

  function storeCookies(setCookie: unknown): void {
    const list = Array.isArray(setCookie)
      ? setCookie
      : typeof setCookie === "string"
        ? [setCookie]
        : [];
    for (const entry of list) {
      const pair = String(entry).split(";")[0].trim();
      const eq = pair.indexOf("=");
      if (eq > 0) {
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (name) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      }
    }
  }

  function cookieHeader(): string {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async function request(
    method: "get" | "post",
    url: string,
    body?: string,
    headers: Record<string, string> = {},
    redirectCount = 0
  ): Promise<SessionResponse> {
    const merged: Record<string, string> = { ...headers };
    const jarCookies = cookieHeader();
    if (jarCookies) {
      merged["Cookie"] = merged["Cookie"]
        ? `${merged["Cookie"]}; ${jarCookies}`
        : jarCookies;
    }

    const response =
      method === "get"
        ? await http.get<string>(url, {
            headers: merged,
            maxRedirects: 0,
            validateStatus: () => true,
          })
        : await http.post<string>(url, body ?? "", {
            headers: merged,
            maxRedirects: 0,
            validateStatus: () => true,
          });

    storeCookies(
      (response.headers as unknown as Record<string, unknown>)?.["set-cookie"]
    );

    const status = response.status;
    const location = (
      response.headers as unknown as Record<string, unknown>
    )?.["location"];
    if (
      status >= 300 &&
      status < 400 &&
      typeof location === "string" &&
      location &&
      redirectCount < maxRedirects
    ) {
      const nextUrl = new URL(location, url).toString();
      const followAsGet =
        method === "get" || [301, 302, 303].includes(status);
      return request(
        followAsGet ? "get" : "post",
        nextUrl,
        followAsGet ? undefined : body,
        headers,
        redirectCount + 1
      );
    }

    if (status >= 400) {
      // Axios-shaped failure so withRetry() and the adapters' catch blocks
      // (err.response.status → 429 / API-error mapping) behave exactly as
      // they do for direct axios calls.
      const failure = new Error(`Request failed with status code ${status}`);
      (failure as { response?: unknown }).response = {
        status,
        headers: response.headers,
        data: response.data,
      };
      throw failure;
    }

    return { status, data: response.data ?? "" };
  }

  return {
    get: (url, opts) => request("get", url, undefined, opts?.headers),
    post: (url, body, opts) => request("post", url, body, opts?.headers),
  };
}
