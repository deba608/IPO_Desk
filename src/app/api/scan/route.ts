// src/app/api/scan/route.ts
// Cross-IPO scan: check the same PAN set against every active IPO at once.
// Fans out across registrars, so the PAN cap is lower and the rate limit
// tighter than the single-IPO /api/check endpoint.
import { NextResponse } from "next/server";
import { z } from "zod";
import { scanAllotment } from "@/services/registrar.service";
import { getClientKey, isRateLimited } from "@/lib/rate-limit";

const RATE_LIMIT = 5; // scans per minute (each scan = many registrar calls)
const RATE_WINDOW_MS = 60 * 1000;

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
  if (isRateLimited(getClientKey(request), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many scans. Please wait before retrying." },
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
    return NextResponse.json(
      { error: "Failed to scan allotments. Please try again." },
      { status: 500 }
    );
  }
}
