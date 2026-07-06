import type { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let initPromise: Promise<void> | null = null;

async function initPrisma(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgresql")) {
    initPromise = null;
    throw new Error("DATABASE_URL not configured");
  }
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const mod = await import("@/generated/prisma/client");
  const client = new mod.PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  globalForPrisma.prisma = client as PrismaClient;
}

/** Returns the PrismaClient singleton. Imported dynamically to avoid Turbopack resolve issues. */
export async function getPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  if (!initPromise) {
    initPromise = initPrisma();
  }

  await initPromise;
  return globalForPrisma.prisma!;
}
