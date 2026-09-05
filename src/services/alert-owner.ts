// src/services/alert-owner.ts
// Alert ownership: a signed-in Google user owns by userId (takes precedence),
// anonymous clients own by x-device-id (as before). Device rows are migrated
// to the user on first login via /api/alerts/link.

import { auth } from "@/auth";
import { checkDbAvailability, getPrisma } from "./db.service";

export type AlertOwner = { userId: string } | { deviceId: string };

/** Create the user row on first authenticated use. Null when DB is absent. */
export async function ensureUser(
  email: string,
  name?: string | null,
  avatarUrl?: string | null
): Promise<string | null> {
  if (!checkDbAvailability()) return null;
  try {
    const prisma = await getPrisma();
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: name ?? undefined, avatarUrl: avatarUrl ?? undefined },
      create: { email, name: name ?? undefined, avatarUrl: avatarUrl ?? undefined },
      select: { id: true },
    });
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Resolve who owns this request's alerts. Returns null when neither a
 * session nor a valid device id is present (callers answer 401).
 */
export async function resolveAlertOwner(
  deviceId: string | null
): Promise<AlertOwner | null> {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (email) {
      const userId = await ensureUser(
        email,
        session?.user?.name,
        session?.user?.image
      );
      if (userId) return { userId };
    }
  } catch {
    // Session unreadable — fall through to device scoping.
  }
  return deviceId ? { deviceId } : null;
}

/** Spreadable Prisma where/data fragment for the resolved owner. */
export function ownerFilter(owner: AlertOwner): { userId: string } | { deviceId: string } {
  return "userId" in owner ? { userId: owner.userId } : { deviceId: owner.deviceId };
}
