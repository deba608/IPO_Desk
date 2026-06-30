const globalForPrisma = globalThis as unknown as {
  prisma: unknown | undefined;
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
  globalForPrisma.prisma = client;
}

/** Returns the PrismaClient singleton. Imported dynamically to avoid Turbopack resolve issues. */
export async function getPrisma(): Promise<any> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  if (!initPromise) {
    initPromise = initPrisma();
  }

  await initPromise;
  return globalForPrisma.prisma;
}
