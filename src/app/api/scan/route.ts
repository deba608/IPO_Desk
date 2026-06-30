// src/app/api/scan/route.ts
// Cross-IPO scan: check the same PAN set against every active IPO at once.
// Fans out across registrars, so the PAN cap is lower and the rate limit
// tighter than the single-IPO /api/check endpoint.
import { NextResponse } from "next/server";
import { z } from "zod";
import { scanAllotment } from "@/services/registrar.service";

// Rate limiting (simple in-memory — use Upstash Redis in production)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // scans per minute (each scan = many registrar calls)
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

const PANSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format");

const ScanRequestSchema = z.object({
  pans: z
    .array(PANSchema)
    .min(1, "At least one PAN is required")
    .max(50, "Maximum 50 PANs per scan"),
  registrar: z.enum(["kfintech", "linkintime", "bigshare", "mufg"]).optional(),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many scans. Please wait before retrying." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const validated = ScanRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const uniquePANs = [...new Set(validated.data.pans)];

    const result = await scanAllotment({
      pans: uniquePANs,
      registrar: validated.data.registrar,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error("[/api/scan] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
