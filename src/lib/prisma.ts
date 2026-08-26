import type { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let initPromise: Promise<void> | null = null;

// Accept both canonical "postgresql://" and the equally valid "postgres://".
function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

async function initPrisma(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !isPostgresUrl(url)) {
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
    // A rejected promise must not be cached — one transient failure (bad
    // connection, cold adapter import) would otherwise poison the singleton
    // until the next process restart.
    initPromise = initPrisma().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
  return globalForPrisma.prisma!;
}
