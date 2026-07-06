import { NextResponse } from "next/server";
import { z } from "zod";
import { checkDbAvailability, getPrisma } from "@/services/db.service";

export const dynamic = "force-dynamic";

const CreateAlertSchema = z.object({
  ipoId: z.string().min(1),
  trigger: z.enum(["gmp_crossed", "subscription_milestone", "ipo_opens", "allotment_available"]),
  threshold: z.number().optional(),
});

export async function GET() {
  if (!checkDbAvailability()) {
    return NextResponse.json({ alerts: [] });
  }
  try {
    const prisma = await getPrisma();
    const alerts = await prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ alerts });
  } catch {
    return NextResponse.json({ alerts: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
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
  } catch {
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
  } catch {
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
