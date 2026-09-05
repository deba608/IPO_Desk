// src/services/captcha.service.ts
// Bigshare CAPTCHA solver. Fetches a fresh CAPTCHA from Bigshare and solves
// the image with the OCR.Space free API (pure HTTPS POST — no WASM, no
// worker threads, no native dependencies, so it runs on any serverless
// runtime including Vercel).
//
// Shared by the /api/bigshare/captcha route AND the BigShareAdapter directly.
// The adapter must NOT self-HTTP to its own API route (relative URLs are
// invalid server-side), so the solver logic lives here.
//
// Free tier: 25,000 requests/month, no credit card. Get a key at
// https://ocr.space/ocrapi and set OCR_SPACE_API_KEY. Without a key the
// rate-limited "helloworld" demo key is used as a fallback.
//
// Speed note (bulk uploads): a LOCAL ddddocr solver (scripts/solve_captcha.py,
// already installed in the Dockerfile) is tried FIRST — ~200-500ms with no
// network or quota. The remote OCR.Space path below is only the fallback
// (e.g. Vercel, where python/ddddocr are unavailable).

import { spawn } from "node:child_process";
import path from "node:path";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const OCR_API_URL = "https://api.ocr.space/parse/image";

/** Read lazily so a key added after the last build still applies at runtime. */
function ocrApiKey(): string {
  return process.env.OCR_SPACE_API_KEY?.trim() || "helloworld";
}

/** Per-request timeout so a hung upstream can never stall /api/check. */
const FETCH_TIMEOUT_MS = 10_000;

/** Hard cap for the local ddddocr subprocess (it is normally ~200-500ms). */
const LOCAL_OCR_TIMEOUT_MS = 10_000;

/** Primary engine first (best for small numeric captchas); fallbacks raced. */
const OCR_PRIMARY_ENGINE = 2;
const OCR_FALLBACK_ENGINES = [1, 3] as const;

/** One short backoff on HTTP 429 before falling back (bulk bursts). */
const RATE_LIMIT_DELAY_MS = 1500;

class OcrRateLimitError extends Error {}
class OcrUnreadableError extends Error {}

/**
 * Circuit-breaker for the local solver. Once the subprocess proves
 * unavailable (no python3, missing script, or no ddddocr — the normal case
 * on Vercel serverless), skip spawning for the rest of the process lifetime
 * so every PAN doesn't pay for a doomed spawn. Transient failures (timeout,
 * unreadable image) do NOT trip it — those still fall back to remote OCR
 * per-PAN.
 */
let localOcrUnavailable = false;

/** Lets /api/health report which OCR path this instance will actually use. */
export function isLocalOcrUnavailable(): boolean {
  return localOcrUnavailable;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CaptchaSolution {
  token: string;
  answer: string;
}

interface CaptchaResponse {
  token?: string;
  image?: string;
}

interface OcrSpaceResponse {
  OCRExitCode?: number;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string[] | string;
  ParsedResults?: Array<{ ParsedText?: string }>;
}

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

/**
 * Pull the 6-digit captcha answer out of raw OCR text. Prefers an exact
 * 6-digit run; falls back to the digit soup only when it is exactly 6 long.
 */
function extractAnswer(raw: string): string | null {
  const sixRun = raw.match(/\d{6}/);
  if (sixRun) return sixRun[0];
  const digits = raw.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

/** Single OCR.Space attempt with one engine. Throws typed errors. */
async function ocrWithEngine(engine: number, dataUrl: string): Promise<string> {
  const form = new URLSearchParams({
    apikey: ocrApiKey(),
    base64Image: dataUrl,
    OCREngine: String(engine),
    scale: "true",
    isTable: "false",
    detectOrientation: "false",
  });
  const response = await fetchWithTimeout(OCR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: form.toString(),
  });
  if (response.status === 429) {
    throw new OcrRateLimitError("OCR API rate limit exceeded (HTTP 429)");
  }
  if (!response.ok) {
    throw new Error(`OCR API returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as OcrSpaceResponse;
  if (body?.IsErroredOnProcessing) {
    const msg = Array.isArray(body.ErrorMessage)
      ? body.ErrorMessage.join("; ")
      : (body.ErrorMessage ?? "processing error");
    throw new Error(`OCR API error: ${msg}`);
  }
  const text = body?.ParsedResults?.[0]?.ParsedText ?? "";
  const answer = extractAnswer(text);
  if (!answer) {
    throw new OcrUnreadableError(
      `OCR engine ${engine} could not read the image (got ${JSON.stringify(text)})`
    );
  }
  return answer;
}

/**
 * Remote OCR with a Vercel-friendly latency profile:
 *  - typical case: ONE request (primary engine) → ~2s;
 *  - primary miss: fallback engines raced IN PARALLEL (latency = slowest
 *    one, not the sum — the old serial loop paid for all three);
 *  - 429: one short backoff retry, then the parallel fallback (another
 *    engine often still has quota).
 * Parallel fallback costs extra quota only on primary misses (the minority).
 */
async function ocrImage(imageBase64: string): Promise<string> {
  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;

  let lastError = "OCR failed on all engines";
  try {
    return await ocrWithEngine(OCR_PRIMARY_ENGINE, dataUrl);
  } catch (error: unknown) {
    lastError = error instanceof Error ? error.message : "OCR request failed";
    if (error instanceof OcrRateLimitError) {
      await delay(RATE_LIMIT_DELAY_MS);
      try {
        return await ocrWithEngine(OCR_PRIMARY_ENGINE, dataUrl);
      } catch (retryError: unknown) {
        lastError =
          retryError instanceof Error ? retryError.message : lastError;
      }
    }
  }

  const settled = await Promise.allSettled(
    OCR_FALLBACK_ENGINES.map((engine) => ocrWithEngine(engine, dataUrl))
  );
  for (const result of settled) {
    if (result.status === "fulfilled") return result.value;
  }
  const details = settled
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason)
    .map((e) => (e instanceof Error ? e.message : String(e)))
    .join(" | ");
  throw new Error(details ? `${lastError} || ${details}` : lastError);
}

/**
 * Fetch and solve a fresh Bigshare CAPTCHA. Tries the local ddddocr solver
 * first (fast, no quota); falls back to remote OCR.Space. Throws when the
 * CAPTCHA service is unreachable or ALL OCR paths fail.
 */
export async function solveBigShareCaptcha(): Promise<CaptchaSolution> {
  const response = await fetchWithTimeout(
    "https://ipo.bigshareonline.com/Captcha.ashx",
    { headers: { "User-Agent": USER_AGENT } }
  );
  if (!response.ok) {
    throw new Error(`CAPTCHA service returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as CaptchaResponse;
  if (!body?.token || !body?.image) {
    throw new Error("CAPTCHA service returned an incomplete response");
  }

  const rawImage = body.image.includes(",")
    ? (body.image.split(",")[1] ?? "")
    : body.image;
  if (!rawImage) {
    throw new Error("CAPTCHA service returned an empty image");
  }

  // Local solver first — on Docker/VPS this avoids a ~1.5-3s remote round
  // trip plus free-tier 429 backoffs during bulk bursts.
  const local = await tryLocalOcr(rawImage);
  if (local) return { token: body.token, answer: local };

  const answer = await ocrImage(rawImage);
  return { token: body.token, answer };
}

/**
 * Local fast-path: pipe the captcha image through scripts/solve_captcha.py
 * (ddddocr). Resolves to the 6-digit answer or null when local OCR is
 * unavailable/failed — the caller then falls back to remote OCR.Space.
 * Never throws.
 */
async function tryLocalOcr(imageBase64: string): Promise<string | null> {
  // Circuit-breaker: on Vercel (no python3/ddddocr) the first PAN trips this
  // and every later PAN skips the doomed spawn entirely.
  if (localOcrUnavailable) return null;
  const script = path.join(process.cwd(), "scripts", "solve_captcha.py");
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: string | null) => {
      if (!done) {
        done = true;
        resolve(value);
      }
    };
    let child;
    try {
      child = spawn("python3", [script], { stdio: ["pipe", "pipe", "pipe"] });
    } catch {
      localOcrUnavailable = true;
      finish(null);
      return;
    }
    let stdout = "";
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      // Timeout = transient (loaded host, slow image) — do NOT trip breaker.
      finish(null);
    }, LOCAL_OCR_TIMEOUT_MS);
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.on("error", () => {
      // ENOENT (no python3) — permanently unavailable on this host.
      localOcrUnavailable = true;
      clearTimeout(timer);
      finish(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      // solve_captcha.py exits 2 when ddddocr can't be imported and non-zero
      // when the script itself is missing — both permanent for this host.
      if (code === 2) localOcrUnavailable = true;
      finish(extractAnswer(stdout) ?? null);
    });
    try {
      child.stdin.write(imageBase64);
      child.stdin.end();
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}
