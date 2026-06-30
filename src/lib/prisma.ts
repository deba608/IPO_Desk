import type { PrismaClient as PrismaClientType } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

let initPromise: Promise<void> | null = null;

async function initPrisma(): Promise<PrismaClientType> {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgresql")) {
    throw new Error("DATABASE_URL not configured");
  }
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/generated/prisma/client");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export async function getPrisma(): Promise<PrismaClientType> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma!;

  if (!initPromise) {
    initPromise = initPrisma().then((client) => {
      globalForPrisma.prisma = client;
    });
  }

  await initPromise;
  return globalForPrisma.prisma!;
}
