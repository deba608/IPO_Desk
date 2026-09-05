// src/app/api/health/route.ts
// Deployment diagnostic: lets anyone verify in seconds which code is live
// and whether required server config is present — without exposing secrets.
// Compare `commit` here against origin/main HEAD to rule out stale deploys.

import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isLocalOcrUnavailable } from "@/services/captcha.service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    // Vercel auto-sets this; undefined locally or on other hosts.
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    environment: process.env.VERCEL_ENV ?? "unknown",
    node: process.version,
    // Presence flags only — never the values.
    ocrKeyConfigured: Boolean(process.env.OCR_SPACE_API_KEY?.trim()),
    // Which Bigshare CAPTCHA path this instance will use: the local ddddocr
    // solver (Docker/VPS) or remote OCR.Space (Vercel serverless).
    localOcrScriptPresent: existsSync(
      join(process.cwd(), "scripts", "solve_captcha.py")
    ),
    localOcrCircuitTripped: isLocalOcrUnavailable(),
    databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    checkedAt: new Date().toISOString(),
  });
}
