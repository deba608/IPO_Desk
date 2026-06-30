import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const seedIpos = [
  {
    slug: "mainboard-acme-corp-2026",
    name: "Acme Corp Ltd",
    symbol: "ACME",
    board: "mainboard" as const,
    registrar: "kfintech" as const,
    status: "open" as const,
    leadManagers: ["ICICI Securities", "Kotak Mahindra"],
    issueSizeCr: 1850,
    priceBandMin: 425,
    priceBandMax: 450,
    lotSize: 32,
    minInvestment: 14400,
    openDate: new Date("2026-06-28T00:00:00Z"),
    closeDate: new Date("2026-07-02T00:00:00Z"),
    allotmentDate: new Date("2026-07-05T00:00:00Z"),
    listingDate: new Date("2026-07-08T00:00:00Z"),
    exchanges: ["NSE", "BSE"],
  },
  {
    slug: "mainboard-bharat-electronics-2026",
    name: "Bharat Electronics Ltd",
    symbol: "BEL",
    board: "mainboard" as const,
    registrar: "mufg" as const,
    status: "open" as const,
    leadManagers: ["SBI Capital Markets", "Axis Capital"],
    issueSizeCr: 4200,
    priceBandMin: 310,
    priceBandMax: 328,
    lotSize: 45,
    minInvestment: 14760,
    openDate: new Date("2026-06-29T00:00:00Z"),
    closeDate: new Date("2026-07-03T00:00:00Z"),
    allotmentDate: new Date("2026-07-07T00:00:00Z"),
    listingDate: new Date("2026-07-10T00:00:00Z"),
    exchanges: ["NSE", "BSE"],
  },
  {
    slug: "sme-green-energy-2026",
    name: "Green Energy Solutions",
    symbol: "GREEN",
    board: "sme" as const,
    registrar: "bigshare" as const,
    status: "upcoming" as const,
    leadManagers: ["First Overseas Capital"],
    issueSizeCr: 75,
    priceBandMin: 120,
    priceBandMax: 126,
    lotSize: 100,
    minInvestment: 12600,
    openDate: new Date("2026-07-10T00:00:00Z"),
    closeDate: new Date("2026-07-14T00:00:00Z"),
    allotmentDate: new Date("2026-07-17T00:00:00Z"),
    listingDate: new Date("2026-07-20T00:00:00Z"),
    exchanges: ["NSE"],
  },
  {
    slug: "mainboard-tech pioneers-2026",
    name: "Tech Pioneers India Ltd",
    symbol: "TECHP",
    board: "mainboard" as const,
    registrar: "kfintech" as const,
    status: "closed" as const,
    leadManagers: ["Goldman Sachs India", "Nomura"],
    issueSizeCr: 5600,
    priceBandMin: 540,
    priceBandMax: 565,
    lotSize: 26,
    minInvestment: 14690,
    openDate: new Date("2026-06-15T00:00:00Z"),
    closeDate: new Date("2026-06-19T00:00:00Z"),
    allotmentDate: new Date("2026-06-23T00:00:00Z"),
    listingDate: new Date("2026-06-27T00:00:00Z"),
    exchanges: ["NSE", "BSE"],
  },
  {
    slug: "mainboard-national-infra-2026",
    name: "National Infra Developers",
    symbol: "NIDL",
    board: "mainboard" as const,
    registrar: "mufg" as const,
    status: "listed" as const,
    leadManagers: ["HDFC Bank", "ICICI Securities"],
    issueSizeCr: 3200,
    priceBandMin: 275,
    priceBandMax: 290,
    lotSize: 50,
    minInvestment: 14500,
    openDate: new Date("2026-05-20T00:00:00Z"),
    closeDate: new Date("2026-05-24T00:00:00Z"),
    allotmentDate: new Date("2026-05-28T00:00:00Z"),
    listingDate: new Date("2026-06-01T00:00:00Z"),
    listingPrice: 340,
    exchanges: ["NSE", "BSE"],
  },
];

async function main() {
  console.log("Seeding database...");

  for (const ipo of seedIpos) {
    await prisma.ipo.upsert({
      where: { slug: ipo.slug },
      update: ipo,
      create: ipo,
    });
    console.log(`  ✓ ${ipo.name}`);
  }

  // Add GMP snapshots for the listed IPO
  const listedIpo = await prisma.ipo.findUnique({ where: { slug: "mainboard-national-infra-2026" } });
  if (listedIpo) {
    const snapshots = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      snapshots.push({
        ipoId: listedIpo.id,
        gmp: Math.round(30 + Math.random() * 20),
        date: d,
        source: "investorgain",
      });
    }
    await prisma.gmpSnapshot.createMany({ data: snapshots });
    console.log(`  ✓ GMP history for ${listedIpo.name}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
