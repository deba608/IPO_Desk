import { CalendarIPO } from "@/types/calendar.types";

function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00+05:30");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function hourBucket(): number {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const localOffset = now.getTimezoneOffset() * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + localOffset);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

function gmpVariance(): number {
  const h = hourBucket();
  return (h * 7 + 13) % 11 - 5;
}

function subVariance(): number {
  const h = hourBucket();
  return ((h * 13 + 7) % 21) / 10;
}

const templates = [
  {
    id: "mainboard-helios-energy",
    name: "Helios Renewable Energy Ltd",
    symbol: "HELIOS",
    board: "mainboard" as const,
    registrar: "kfintech" as const,
    leadManagers: ["Kotak Mahindra Capital", "Axis Capital"],
    issueSizeCr: 2100,
    priceBand: { min: 440, max: 463 },
    lotSize: 32,
    exchanges: ["NSE", "BSE"] as ("NSE" | "BSE")[],
    gmp: 96,
  },
  {
    id: "mainboard-cobalt-systems",
    name: "Cobalt Systems Ltd",
    symbol: "COBALT",
    board: "mainboard" as const,
    registrar: "kfintech" as const,
    leadManagers: ["Morgan Stanley India", "Axis Capital"],
    issueSizeCr: 1450,
    priceBand: { min: 388, max: 408 },
    lotSize: 36,
    exchanges: ["NSE", "BSE"] as ("NSE" | "BSE")[],
    gmp: 142,
    subscriptionBase: { qib: 8.4, nii: 14.2, retail: 5.1, total: 9.3 },
  },
  {
    id: "mainboard-nimbus-fintech",
    name: "Nimbus Fintech Ltd",
    symbol: "NIMBUS",
    board: "mainboard" as const,
    registrar: "mufg" as const,
    leadManagers: ["Kotak Mahindra Capital", "Citigroup Global Markets"],
    issueSizeCr: 3200,
    priceBand: { min: 615, max: 648 },
    lotSize: 23,
    exchanges: ["NSE", "BSE"] as ("NSE" | "BSE")[],
    gmp: 210,
    subscriptionBase: { qib: 45.2, nii: 88.7, retail: 12.3, total: 41.5 },
  },
  {
    id: "mainboard-quanta-semicon",
    name: "Quanta Semiconductors Ltd",
    symbol: "QUANTA",
    board: "mainboard" as const,
    registrar: "kfintech" as const,
    leadManagers: ["Goldman Sachs India", "Axis Capital", "JM Financial"],
    issueSizeCr: 4100,
    priceBand: { min: 720, max: 760 },
    lotSize: 19,
    exchanges: ["NSE", "BSE"] as ("NSE" | "BSE")[],
    listingPrice: 1012,
  },
  {
    id: "mainboard-aether-logistics",
    name: "Aether Logistics Ltd",
    symbol: "AETHER",
    board: "mainboard" as const,
    registrar: "linkintime" as const,
    leadManagers: ["JM Financial", "ICICI Securities"],
    issueSizeCr: 870,
    priceBand: { min: 256, max: 270 },
    lotSize: 55,
    exchanges: ["NSE", "BSE"] as ("NSE" | "BSE")[],
  },
  {
    id: "mainboard-saffron-foods",
    name: "Saffron Foods & Beverages Ltd",
    symbol: "SAFFRON",
    board: "mainboard" as const,
    registrar: "linkintime" as const,
    leadManagers: ["ICICI Securities", "Nuvama Wealth"],
    issueSizeCr: 980,
    priceBand: { min: 295, max: 310 },
    lotSize: 48,
    exchanges: ["NSE", "BSE"] as ("NSE" | "BSE")[],
    listingPrice: 287,
  },
  {
    id: "sme-trentwood-interiors",
    name: "Trentwood Interiors Ltd",
    symbol: "TRENTWD",
    board: "sme" as const,
    registrar: "bigshare" as const,
    leadManagers: ["Hem Securities"],
    issueSizeCr: 38.5,
    priceBand: { min: 119, max: 126 },
    lotSize: 1000,
    exchanges: ["NSE"] as ("NSE" | "BSE")[],
    gmp: 22,
  },
  {
    id: "sme-vajra-precision",
    name: "Vajra Precision Components Ltd",
    symbol: "VAJRA",
    board: "sme" as const,
    registrar: "bigshare" as const,
    leadManagers: ["Beeline Capital Advisors"],
    issueSizeCr: 54.2,
    priceBand: { min: 165, max: 175 },
    lotSize: 800,
    exchanges: ["BSE"] as ("NSE" | "BSE")[],
    gmp: 48,
    subscriptionBase: { qib: 2.1, nii: 18.6, retail: 22.4, total: 12.8 },
  },
  {
    id: "sme-orchid-agritech",
    name: "Orchid Agritech Ltd",
    symbol: "ORCHID",
    board: "sme" as const,
    registrar: "linkintime" as const,
    leadManagers: ["Gretex Corporate Services"],
    issueSizeCr: 29.8,
    priceBand: { min: 88, max: 93 },
    lotSize: 1200,
    exchanges: ["NSE"] as ("NSE" | "BSE")[],
    gmp: 14,
  },
  {
    id: "sme-pinnacle-robotics",
    name: "Pinnacle Robotics Ltd",
    symbol: "PINROBO",
    board: "sme" as const,
    registrar: "bigshare" as const,
    leadManagers: ["Unistone Capital"],
    issueSizeCr: 61.4,
    priceBand: { min: 198, max: 210 },
    lotSize: 600,
    exchanges: ["NSE"] as ("NSE" | "BSE")[],
    listingPrice: 351,
  },
];

function buildSeedIPO(t: typeof templates[number], today: string): CalendarIPO {
  const now = new Date();
  const nowISO = now.toISOString();

  switch (t.id) {
    // Upcoming: open in 4 days
    case "mainboard-helios-energy": {
      const open = addDays(today, 4);
      return {
        ...t,
        id: `${t.id}-${open.slice(0, 7)}`,
        openDate: open,
        closeDate: addDays(open, 2),
        listingDate: addDays(open, 5),
        gmp: t.gmp! + gmpVariance(),
        gmpUpdatedAt: nowISO,
      };
    }
    // Upcoming: open in 7 days
    case "mainboard-aether-logistics": {
      const open = addDays(today, 7);
      return {
        ...t,
        id: `${t.id}-${open.slice(0, 7)}`,
        openDate: open,
        closeDate: addDays(open, 2),
        listingDate: addDays(open, 5),
      };
    }
    // Upcoming: open in 14 days
    case "sme-trentwood-interiors": {
      const open = addDays(today, 14);
      return {
        ...t,
        id: `${t.id}-${open.slice(0, 7)}`,
        openDate: open,
        closeDate: addDays(open, 2),
        listingDate: addDays(open, 7),
        gmp: t.gmp! + gmpVariance(),
        gmpUpdatedAt: nowISO,
      };
    }
    // Open: closing tomorrow
    case "mainboard-cobalt-systems": {
      const open = addDays(today, -4);
      const close = addDays(today, 1);
      return {
        ...t,
        id: `${t.id}-${open.slice(0, 7)}`,
        openDate: open,
        closeDate: close,
        allotmentDate: addDays(close, 1),
        listingDate: addDays(close, 3),
        gmp: t.gmp! + gmpVariance(),
        gmpUpdatedAt: nowISO,
        subscription: {
          qib: round1(t.subscriptionBase!.qib + subVariance()),
          nii: round1(t.subscriptionBase!.nii + subVariance()),
          retail: round1(t.subscriptionBase!.retail + subVariance()),
          total: round1(t.subscriptionBase!.total + subVariance()),
          updatedAt: nowISO,
        },
      };
    }
    // Open: closing in 2 days
    case "sme-vajra-precision": {
      const open = addDays(today, -3);
      const close = addDays(today, 2);
      return {
        ...t,
        id: `${t.id}-${open.slice(0, 7)}`,
        openDate: open,
        closeDate: close,
        allotmentDate: addDays(close, 1),
        listingDate: addDays(close, 3),
        gmp: t.gmp! + gmpVariance(),
        gmpUpdatedAt: nowISO,
        subscription: {
          qib: round1(t.subscriptionBase!.qib + subVariance()),
          nii: round1(t.subscriptionBase!.nii + subVariance()),
          retail: round1(t.subscriptionBase!.retail + subVariance()),
          total: round1(t.subscriptionBase!.total + subVariance()),
          updatedAt: nowISO,
        },
      };
    }
    // Closed: closed 1 day ago, listing in 2 days
    case "mainboard-nimbus-fintech": {
      const close = addDays(today, -1);
      const open = addDays(close, -2);
      return {
        ...t,
        id: `${t.id}-${open.slice(0, 7)}`,
        openDate: open,
        closeDate: close,
        allotmentDate: today,
        listingDate: addDays(today, 2),
        gmp: t.gmp! + gmpVariance(),
        gmpUpdatedAt: nowISO,
        subscription: {
          qib: round1(t.subscriptionBase!.qib + subVariance()),
          nii: round1(t.subscriptionBase!.nii + subVariance()),
          retail: round1(t.subscriptionBase!.retail + subVariance()),
          total: round1(t.subscriptionBase!.total + subVariance()),
          updatedAt: nowISO,
        },
      };
    }
    // Closed: closed 2 days ago, no listing date yet
    case "sme-orchid-agritech": {
      const close = addDays(today, -2);
      const open = addDays(close, -2);
      return {
        ...t,
        id: `${t.id}-${open.slice(0, 7)}`,
        openDate: open,
        closeDate: close,
        allotmentDate: addDays(today, 1),
        gmp: t.gmp! + gmpVariance(),
        gmpUpdatedAt: nowISO,
      };
    }
    // Listed: listed 1 day ago
    case "mainboard-quanta-semicon": {
      const listing = addDays(today, -1);
      const close = addDays(listing, -5);
      return {
        ...t,
        id: `${t.id}-${close.slice(0, 7)}`,
        openDate: addDays(close, -2),
        closeDate: close,
        listingDate: listing,
        exchanges: ["NSE", "BSE"],
      };
    }
    // Listed: listed 4 days ago
    case "mainboard-saffron-foods": {
      const listing = addDays(today, -4);
      const close = addDays(listing, -5);
      return {
        ...t,
        id: `${t.id}-${close.slice(0, 7)}`,
        openDate: addDays(close, -2),
        closeDate: close,
        listingDate: listing,
        exchanges: ["NSE", "BSE"],
      };
    }
    // Listed: listed 7 days ago
    case "sme-pinnacle-robotics": {
      const listing = addDays(today, -7);
      const close = addDays(listing, -5);
      return {
        ...t,
        id: `${t.id}-${close.slice(0, 7)}`,
        openDate: addDays(close, -2),
        closeDate: close,
        listingDate: listing,
        exchanges: ["NSE"],
      };
    }
    default:
      return t as CalendarIPO;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function getCalendarSeed(): CalendarIPO[] {
  const today = todayIST();
  return templates.map((t) => buildSeedIPO(t, today));
}
