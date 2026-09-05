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

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const OCR_API_URL = "https://api.ocr.space/parse/image";
const OCR_API_KEY = process.env.OCR_SPACE_API_KEY?.trim() || "helloworld";

/** Per-request timeout so a hung upstream can never stall /api/check. */
const FETCH_TIMEOUT_MS = 15_000;

/** OCR engines to try in order; Engine 2 + upscale handles small captchas best. */
const OCR_ENGINES = [2, 1, 3] as const;

/** Same-engine retries on HTTP 429 (bulk bursts) with linear backoff. */
const RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_DELAY_MS = 2000;

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

async function ocrImage(imageBase64: string): Promise<string> {
  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;

  let lastError = "OCR failed on all engines";
  for (const engine of OCR_ENGINES) {
    try {
      const form = new URLSearchParams({
        apikey: OCR_API_KEY,
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
      if (!response.ok) {
        // Bulk bursts can hit the free-tier rate limit — back off and retry
        // the same engine instead of burning through the engine fallback.
        if (response.status === 429) {
          for (let retry = 1; retry <= RATE_LIMIT_RETRIES; retry++) {
            await delay(RATE_LIMIT_DELAY_MS * retry);
            const retryRes = await fetchWithTimeout(OCR_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": USER_AGENT,
              },
              body: form.toString(),
            });
            if (retryRes.ok) {
              const retryBody = (await retryRes.json()) as OcrSpaceResponse;
              const retryText = retryBody?.ParsedResults?.[0]?.ParsedText ?? "";
              const retryAnswer = extractAnswer(retryText);
              if (retryAnswer) return retryAnswer;
              break;
            }
            if (retryRes.status !== 429) break;
          }
          lastError = "OCR API rate limit exceeded (HTTP 429)";
          continue;
        } else {
          lastError = `OCR API returned HTTP ${response.status}`;
          continue;
        }
      }
      const body = (await response.json()) as OcrSpaceResponse;
      if (body?.IsErroredOnProcessing) {
        const msg = Array.isArray(body.ErrorMessage)
          ? body.ErrorMessage.join("; ")
          : (body.ErrorMessage ?? "processing error");
        lastError = `OCR API error: ${msg}`;
        continue;
      }
      const text = body?.ParsedResults?.[0]?.ParsedText ?? "";
      const answer = extractAnswer(text);
      if (answer) return answer;
      lastError = `OCR engine ${engine} could not read the image (got ${JSON.stringify(text)})`;
    } catch (error: unknown) {
      lastError =
        error instanceof Error ? error.message : "OCR request failed";
    }
  }
  throw new Error(lastError);
}

/**
 * Fetch and solve a fresh Bigshare CAPTCHA. Throws when the CAPTCHA service is
 * unreachable or OCR fails.
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

  const answer = await ocrImage(rawImage);
  return { token: body.token, answer };
}
