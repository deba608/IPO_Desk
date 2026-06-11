// src/app/api/check/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAllotment } from "@/services/registrar.service";

// Rate limiting (simple in-memory — use Upstash Redis in production)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW_MS = 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (record.count >= RATE_LIMIT) return true;

  record.count++;
  return false;
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
  // Get client IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // Rate limiting
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before retrying." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
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

    const result = await checkAllotment({
      pans: uniquePANs,
      ipoClientId: validated.data.ipoClientId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error("[/api/check] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errMsg },
      { status: errMsg.includes("not found") ? 404 : 500 }
    );
  }
}
