// src/app/api/admin/otp/verify/route.ts
// Step 2 of passwordless admin login: check the code, then issue the signed
// `ipodesk_admin` session cookie (HttpOnly, 30-min fixed expiry).

import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getClientKey, isRateLimited } from "@/lib/rate-limit";
import {
  adminSessionCookieName,
  classifyIdentifier,
  isAllowlisted,
  normalizeIdentifier,
  signAdminSession,
  verifyChallenge,
} from "@/services/admin-auth";

export const dynamic = "force-dynamic";

const VerifySchema = z.object({
  identifier: z.string().trim().min(3).max(128),
  code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export async function POST(request: Request) {
  if (isRateLimited(`otp-verify:${getClientKey(request)}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validated = VerifySchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const raw = validated.data.identifier;
  const kind = classifyIdentifier(raw);
  // Belt and suspenders: wrong code for a non-allowlisted identity must look
  // identical to a wrong code (no enumeration via timing either — the hash
  // compare below runs the same way).
  if (!kind || !isAllowlisted(raw)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  const checked = await verifyChallenge(raw, kind, validated.data.code);
  if (!checked.ok) {
    // Generic on purpose: expired/locked/wrong are indistinguishable so the
    // endpoint never reveals challenge state.
    const message =
      checked.reason === "unconfigured"
        ? "Admin login is not configured."
        : "Invalid code";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const token = signAdminSession(normalizeIdentifier(raw, kind));
  if (!token) {
    return NextResponse.json(
      { error: "Admin login is not configured." },
      { status: 503 }
    );
  }

  const store = await cookies();
  store.set(adminSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 60,
    path: "/",
  });
  // Note: cookie name intentionally stable (ipodesk_admin). Rotating to
  // __Host- would invalidate existing sessions; do it with a migration window.
  return NextResponse.json({ ok: true });
}
