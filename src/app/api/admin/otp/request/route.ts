// src/app/api/admin/otp/request/route.ts
// Step 1 of passwordless admin login: accept an email (or phone), and if it
// is allowlisted, create an OTP challenge and email the code. Answers are
// ALWAYS generic so the endpoint never reveals who is allowlisted.

import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { getClientKey, isRateLimited } from "@/lib/rate-limit";
import {
  classifyIdentifier,
  createChallenge,
  isAllowlisted,
} from "@/services/admin-auth";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  identifier: z.string().trim().min(3).max(128),
});

const GENERIC_OK = {
  ok: true,
  message: "If this identity is authorized, a login code is on its way.",
};

function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  try {
    return new Resend(key);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (isRateLimited(`otp-request:${getClientKey(request)}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validated = RequestSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const raw = validated.data.identifier;
  const kind = classifyIdentifier(raw);
  if (!kind) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  // Mobile OTP delivery is not configured — be honest instead of silently
  // dropping the code (the generic answer below would be a lie).
  if (kind === "phone") {
    return NextResponse.json(
      { error: "Mobile OTP is not configured. Please use an allowlisted email." },
      { status: 501 }
    );
  }

  if (!isAllowlisted(raw)) {
    // Indistinguishable from success: no allowlist enumeration.
    return NextResponse.json(GENERIC_OK);
  }

  const created = await createChallenge(raw, kind);
  if (!created.ok) {
    // Throttled or unconfigured — still generic (a 429 here would confirm
    // the identifier is allowlisted).
    if (created.reason === "unconfigured") {
      console.error("[/api/admin/otp/request] admin OTP has no signing secret");
    }
    return NextResponse.json(GENERIC_OK);
  }

  // Deliver the code. No mail provider in dev → print to server console so
  // the flow stays testable without Resend.
  const resend = resendClient();
  if (!resend) {
    console.log(
      `[admin-otp] DEV ONLY — login code for ${created.identifier}: ${created.code}`
    );
  } else {
    try {
      const from =
        process.env.RESEND_FROM?.trim() ?? "IPO Desk <noreply@ipodesk.com>";
      const { error } = await resend.emails.send({
        from,
        to: created.identifier,
        subject: "Your IPO Desk admin login code",
        text: `Your admin login code is ${created.code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      });
      if (error) {
        console.error("[/api/admin/otp/request] Resend failed:", error);
      }
    } catch (error: unknown) {
      console.error("[/api/admin/otp/request] Resend threw:", error);
    }
  }

  return NextResponse.json(GENERIC_OK);
}
