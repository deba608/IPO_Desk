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

export async function GET() {
  if (!checkDbAvailability()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }
  try {
    const prisma = await getPrisma();
    const alerts = await prisma.alert.findMany({
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
    const alert = await prisma.alert.create({
      data: {
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
    await prisma.alert.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    // Prisma P2025 = record to delete does not exist.
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    console.error("[/api/alerts] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
