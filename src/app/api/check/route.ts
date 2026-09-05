// src/app/api/check/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAllotment } from "@/services/registrar.service";
import { getClientKey, isRateLimited } from "@/lib/rate-limit";

// Bulk uploads fan out into many small batch requests (frontend runs up to 3
// in parallel), so the ceiling must fit a 500-PAN upload: 25 batches at size
// 20, plus headroom for retries.
const RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW_MS = 60 * 1000;

// Allow the function to run up to 60s on platforms that support it (Vercel
// Pro / Docker). Hobby-plan caps still apply, but the frontend's batching
// keeps each request well under even a 10s budget.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Absolute ceiling for the whole check pipeline. The client must always get
// a JSON answer (even a 504) instead of spinning until the platform kills
// the function — "loading forever" is never an acceptable outcome.
const CHECK_TIMEOUT_MS = 50_000;

class CheckTimeoutError extends Error {
  constructor() {
    super("Check timed out");
    this.name = "CheckTimeoutError";
  }
}

async function withCheckTimeout<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {});
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CheckTimeoutError()), CHECK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Zod validation schema
const PANSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format");

const CheckRequestSchema = z.object({
  pans: z
    .array(PANSchema)
    .min(1, "At least one PAN is required")
    .max(500, "Maximum 500 PANs per request"),
  // Namespaced IPO id ("mufg-11908") preferred; bare numeric clientIds are
  // still accepted for backwards compatibility. Bigshare ids can be as short
  // as 3 digits.
  ipoClientId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^(?:[a-z]+-)?\d+$/i, "Invalid IPO id"),
});

export async function POST(request: Request) {
  // Rate limiting
  if (isRateLimited(getClientKey(request), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before retrying." },
      { status: 429 }
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const validated = CheckRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Deduplicate PANs
    const uniquePANs = [...new Set(validated.data.pans)];

    const result = await withCheckTimeout(
      checkAllotment({
        pans: uniquePANs,
        ipoClientId: validated.data.ipoClientId,
      })
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    // Log the details server-side; never echo internal error messages
    // (registrar URLs, adapter internals) back to the client.
    console.error("[/api/check] Error:", error);
    if (error instanceof CheckTimeoutError) {
      return NextResponse.json(
        { error: "Check timed out. Please try again with fewer PANs." },
        { status: 504 }
      );
    }
    const errMsg = error instanceof Error ? error.message : "";
    if (errMsg.includes("not found")) {
      return NextResponse.json({ error: "IPO not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to check allotment. Please try again." },
      { status: 500 }
    );
  }
}
