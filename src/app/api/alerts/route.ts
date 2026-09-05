import { NextResponse } from "next/server";
import { z } from "zod";
import { checkDbAvailability, getPrisma } from "@/services/db.service";
import { getClientKey, isRateLimited } from "@/lib/rate-limit";
import { ownerFilter, resolveAlertOwner } from "@/services/alert-owner";

export const dynamic = "force-dynamic";

const TRIGGERS = [
  "gmp_crossed",
  "subscription_milestone",
  "ipo_opens",
  "allotment_available",
] as const;

// Thresholds must be real, positive, sane numbers — NaN/Infinity would pass
// a bare z.number() and poison comparisons downstream.
const ThresholdSchema = z.number().finite().positive().max(100000);

const CreateAlertSchema = z
  .object({
    ipoId: z.string().min(1).max(128),
    trigger: z.enum(TRIGGERS),
    threshold: ThresholdSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (
      (val.trigger === "gmp_crossed" ||
        val.trigger === "subscription_milestone") &&
      val.threshold === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["threshold"],
        message: "threshold is required for this trigger",
      });
    }
  });

const ToggleAlertSchema = z.object({
  id: z.string().min(1).max(64),
  enabled: z.boolean(),
});

// Ownership: signed-in Google users own by userId; everyone else by the
// anonymous x-device-id header (one client can never touch another's rows).
// Device ids are self-asserted scoping, not authentication.
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function readDeviceId(request: Request): string | null {
  const deviceId = request.headers.get("x-device-id")?.trim();
  if (!deviceId || !DEVICE_ID_RE.test(deviceId)) return null;
  return deviceId;
}

function unauthorized() {
  return NextResponse.json(
    { error: "Sign in or provide a valid x-device-id header" },
    { status: 401 }
  );
}

function dbUnavailable() {
  return NextResponse.json(
    { error: "Database not configured" },
    { status: 503 }
  );
}

export async function GET(request: Request) {
  const owner = await resolveAlertOwner(readDeviceId(request));
  if (!owner) return unauthorized();

  if (!checkDbAvailability()) {
    return dbUnavailable();
  }
  try {
    const prisma = await getPrisma();
    const alerts = await prisma.alert.findMany({
      where: ownerFilter(owner),
      orderBy: { createdAt: "desc" },
      take: 100,
      // Name + slug: the UI matches alerts to IPOs by public slug while the
      // FK stores the internal id.
      include: { ipo: { select: { name: true, slug: true } } },
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

  const owner = await resolveAlertOwner(readDeviceId(request));
  if (!owner) return unauthorized();

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
      return dbUnavailable();
    }

    const prisma = await getPrisma();
    // Clients may pass either the internal cuid or the public slug — resolve
    // to the internal id for the FK.
    const ipo = await prisma.ipo.findFirst({
      where: { OR: [{ id: validated.data.ipoId }, { slug: validated.data.ipoId }] },
      select: { id: true },
    });
    if (!ipo) {
      return NextResponse.json({ error: "Unknown ipoId" }, { status: 400 });
    }

    // Cap per-owner alert count so one owner can't grow the table unbounded.
    const existing = await prisma.alert.count({ where: ownerFilter(owner) });
    if (existing >= 100) {
      return NextResponse.json(
        { error: "Alert limit reached (100). Delete some alerts first." },
        { status: 409 }
      );
    }

    // NOTE: channel intentionally omitted — the schema default ("email")
    // applies. No push/email delivery exists yet; alerts are stored rules
    // surfaced in the UI.
    const alert = await prisma.alert.create({
      data: {
        ...ownerFilter(owner),
        ipoId: ipo.id,
        trigger: validated.data.trigger,
        threshold: validated.data.threshold,
      },
    });

    return NextResponse.json({ alert });
  } catch (error) {
    // P2002 = duplicate owner+ipo+trigger — tell the client instead of 500ing.
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "This alert already exists" },
        { status: 409 }
      );
    }
    console.error("[/api/alerts] POST failed:", error);
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (isRateLimited(getClientKey(request), 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const owner = await resolveAlertOwner(readDeviceId(request));
  if (!owner) return unauthorized();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = ToggleAlertSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Validation failed", details: validated.error.flatten() }, { status: 400 });
    }

    if (!checkDbAvailability()) {
      return dbUnavailable();
    }

    const prisma = await getPrisma();
    // Ownership check is part of the predicate — a foreign id 404s instead
    // of toggling someone else's row.
    const updated = await prisma.alert.updateMany({
      where: { id: validated.data.id, ...ownerFilter(owner) },
      data: { enabled: validated.data.enabled },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/alerts] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (isRateLimited(getClientKey(request), 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const owner = await resolveAlertOwner(readDeviceId(request));
  if (!owner) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    if (!checkDbAvailability()) {
      return dbUnavailable();
    }

    const prisma = await getPrisma();
    // deleteMany (not delete): there is no compound unique on (id, owner),
    // and the ownership check belongs in the predicate — a foreign id 404s
    // instead of deleting someone else's row.
    const deleted = await prisma.alert.deleteMany({
      where: { id, ...ownerFilter(owner) },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/alerts] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
