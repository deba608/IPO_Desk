// Database service — wraps Prisma calls with graceful fallback when no DB is configured.
// All callers check `isAvailable()` first, then call the Prisma methods directly or
// use the fallback methods in this service.

let isAvailable: boolean | null = null;

export function checkDbAvailability(): boolean {
  if (isAvailable !== null) return isAvailable;
  try {
    const url = process.env.DATABASE_URL;
    isAvailable = !!(url && url.startsWith("postgresql"));
  } catch {
    isAvailable = false;
  }
  return isAvailable;
}

export function resetDbCheck(): void {
  isAvailable = null;
}

export { prisma } from "@/lib/prisma";
