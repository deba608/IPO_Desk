// src/services/captcha.service.ts
// Bigshare CAPTCHA solver. Fetches a fresh CAPTCHA from Bigshare and solves
// the image with tesseract.js (pure-JS OCR — runs on serverless hosts like
// Vercel without a Python runtime).
//
// Shared by the /api/bigshare/captcha route AND the BigShareAdapter directly.
// The adapter must NOT self-HTTP to its own API route (relative URLs are
// invalid server-side), so the solver logic lives here.

import * as Tesseract from "tesseract.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * Bundled English model `eng.traineddata` committed at the repo root. Pointed
 * to via `langPath` so tesseract.js reads it from the filesystem instead of
 * downloading it from the jsdelivr CDN at runtime (the CDN is unreliable and
 * slow on serverless cold starts). `process.cwd()` is the bundle root on
 * Vercel and the repo root locally, where the file lives.
 */
const LANG_PATH = process.cwd();

// Keep a single warm worker across solves so the OCR engine is loaded once.
let workerPromise: Promise<Tesseract.Worker> | null = null;

/** Time to wait for the OCR worker to produce a result before failing over. */
const OCR_TIMEOUT_MS = 10_000;

async function ocrImage(imageBuffer: Buffer): Promise<string> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng", undefined, {
      langPath: LANG_PATH,
      // The traineddata is bundled at the repo root; don't try to (re)write a
      // cache copy. Vercel serverless filesystems are read-only outside /tmp,
      // and the write attempt would throw inside the worker thread.
      cacheMethod: "none",
    });
  }
  const worker = await workerPromise;
  const promise = worker.recognize(imageBuffer);

  // Guard against a non-responsive OCR worker (e.g. on restrictive serverless
  // runtimes) so the caller never hangs on an unresolved recognize() promise.
  let timer: NodeJS.Timeout | undefined;
  try {
    const { data } = (await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("CAPTCHA OCR timed out")),
          OCR_TIMEOUT_MS
        );
      }),
    ])) as { data: { text?: string } };
    return (data?.text ?? "").replace(/\s+/g, "");
  } finally {
    clearTimeout(timer);
  }
}

/** Drop the worker and re-create it on the next solve after a failure. */
function resetWorker(): void {
  if (workerPromise) {
    workerPromise.then((worker) => worker.terminate()).catch(() => {});
    workerPromise = null;
  }
}

export interface CaptchaSolution {
  token: string;
  answer: string;
}

interface CaptchaResponse {
  token?: string;
  image?: string;
}

/**
 * Fetch and solve a fresh Bigshare CAPTCHA. Throws when the CAPTCHA service is
 * unreachable or OCR fails.
 */
export async function solveBigShareCaptcha(): Promise<CaptchaSolution> {
  const response = await fetch("https://ipo.bigshareonline.com/Captcha.ashx", {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`CAPTCHA service returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as CaptchaResponse;
  if (!body?.token || !body?.image) {
    throw new Error("CAPTCHA service returned an incomplete response");
  }

  const imageBuffer = Buffer.from(
    body.image.split(",")[1] ?? body.image,
    "base64"
  );

  try {
    const answer = await ocrImage(imageBuffer);
    if (!answer) {
      throw new Error("CAPTCHA solver could not read the image");
    }
    return { token: body.token, answer };
  } catch (error: unknown) {
    resetWorker();
    throw new Error(
      error instanceof Error ? error.message : "CAPTCHA OCR failed"
    );
  }
}
