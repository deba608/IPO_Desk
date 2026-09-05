// src/app/api/alerts/link/route.ts
// One-time migration: after Google sign-in, attach this device's anonymous
// alerts to the user account. Idempotent — already-linked rows are skipped.

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkDbAvailability, getPrisma } from "@/services/db.service";
import { getClientKey, isRateLimited } from "@/lib/rate-limit";
import { ensureUser } from "@/services/alert-owner";

export const dynamic = "force-dynamic";

const LinkSchema = z.object({
  deviceId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid device id"),
});

export async function POST(request: Request) {
  if (isRateLimited(`alerts-link:${getClientKey(request)}`, 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let sessionEmail: string | null = null;
  let sessionName: string | null = null;
  let sessionAvatar: string | null = null;
  try {
    const session = await auth();
    sessionEmail = session?.user?.email ?? null;
    sessionName = session?.user?.name ?? null;
    sessionAvatar = session?.user?.image ?? null;
  } catch {
    sessionEmail = null;
  }
  if (!sessionEmail) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validated = LinkSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  if (!checkDbAvailability()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const userId = await ensureUser(sessionEmail, sessionName, sessionAvatar);
    if (!userId) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }
    const prisma = await getPrisma();
    const linked = await prisma.alert.updateMany({
      where: { deviceId: validated.data.deviceId, userId: null },
      data: { userId },
    });
    return NextResponse.json({ linked: linked.count });
  } catch (error) {
    console.error("[/api/alerts/link] failed:", error);
    return NextResponse.json({ error: "Failed to link alerts" }, { status: 500 });
  }
}
