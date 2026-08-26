import { NextResponse } from "next/server";
import { z } from "zod";
import { checkDbAvailability, getPrisma } from "@/services/db.service";
import { getClientKey, isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CreateAlertSchema = z.object({
  ipoId: z.string().min(1).max(128),
  trigger: z.enum(["gmp_crossed", "subscription_milestone", "ipo_opens", "allotment_available"]),
  threshold: z.number().optional(),
});

// Alerts are scoped to an anonymous per-device id (x-device-id header) so one
// client can never read or mutate another client's alerts. When real auth
// lands, this becomes the userId check.
function requireDeviceId(request: Request): string | null {
  const deviceId = request.headers.get("x-device-id")?.trim();
  if (!deviceId || deviceId.length < 8 || deviceId.length > 64) return null;
  return deviceId;
}

export async function GET(request: Request) {
  const deviceId = requireDeviceId(request);
  if (!deviceId) {
    return NextResponse.json(
      { error: "Missing or invalid x-device-id header" },
      { status: 401 }
    );
  }

  if (!checkDbAvailability()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }
  try {
    const prisma = await getPrisma();
    const alerts = await prisma.alert.findMany({
      where: { deviceId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ alerts });
  } catch (error) {
    // Don't mask an outage as an empty list.
    console.error("[/api/alerts] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (isRateLimited(getClientKey(request), 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const deviceId = requireDeviceId(request);
  if (!deviceId) {
    return NextResponse.json(
      { error: "Missing or invalid x-device-id header" },
      { status: 401 }
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = CreateAlertSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Validation failed", details: validated.error.flatten() }, { status: 400 });
    }

    if (!checkDbAvailability()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const prisma = await getPrisma();
    // Cap per-device alert count so a device can't grow the table unbounded.
    const existing = await prisma.alert.count({ where: { deviceId } });
    if (existing >= 100) {
      return NextResponse.json(
        { error: "Alert limit reached (100). Delete some alerts first." },
        { status: 409 }
      );
    }

    const alert = await prisma.alert.create({
      data: {
        deviceId,
        ipoId: validated.data.ipoId,
        trigger: validated.data.trigger,
        threshold: validated.data.threshold,
        channel: "push",
      },
    });

    return NextResponse.json({ alert });
  } catch (error) {
    console.error("[/api/alerts] POST failed:", error);
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (isRateLimited(getClientKey(request), 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const deviceId = requireDeviceId(request);
  if (!deviceId) {
    return NextResponse.json(
      { error: "Missing or invalid x-device-id header" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    if (!checkDbAvailability()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const prisma = await getPrisma();
    // Ownership check is part of the delete predicate — a foreign id 404s
    // instead of deleting someone else's row.
    await prisma.alert.delete({ where: { id, deviceId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    // Prisma P2025 = record to delete does not exist (or belongs to another device).
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    console.error("[/api/alerts] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
