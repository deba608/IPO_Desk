let isAvailable: boolean | null = null;

export function checkDbAvailability(): boolean {
  if (isAvailable !== null) return isAvailable;
  try {
    const url = process.env.DATABASE_URL ?? "";
    // Both "postgresql://" and "postgres://" are valid Postgres schemes.
    isAvailable = url.startsWith("postgresql://") || url.startsWith("postgres://");
  } catch {
    isAvailable = false;
  }
  return isAvailable;
}

export function resetDbCheck(): void {
  isAvailable = null;
}

export { getPrisma } from "@/lib/prisma";
