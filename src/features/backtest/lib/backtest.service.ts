import { HISTORICAL_IPOS, HistoricalIPO } from "../data/historical-ipos";

export interface BacktestCriteria {
  minGmpPercent: number;
  minQibSubscription: number;
  minRetailSubscription: number;
  minTotalSubscription: number;
  board: "all" | "mainboard" | "sme";
  minIssueSizeCr?: number;
  maxIssueSizeCr?: number;
  sector?: string;
}

export interface ReturnDistributionTier {
  range: string;
  count: number;
  percentage: number;
  color: string;
}

export interface StrategySimulationResult {
  criteria: BacktestCriteria;
  totalHistoricalIpos: number;
  matchedCount: number;
  matchedIpos: HistoricalIPO[];
  winCount: number; // gain > 0
  lossCount: number; // gain < 0
  neutralCount: number; // gain === 0
  winRatePercent: number;
  avgListingGainPercent: number;
  medianListingGainPercent: number;
  maxGainPercent: number;
  maxLossPercent: number;
  bestIpo?: HistoricalIPO;
  worstIpo?: HistoricalIPO;
  
  // Benchmark metrics
  benchmarkTotalIpos: number;
  benchmarkWinRatePercent: number;
  benchmarkAvgGainPercent: number;
  alphaVsBenchmark: number; // Strategy Avg Gain - Benchmark Avg Gain

  // Capital simulation (assuming fixed initial investment per IPO or fixed capital base)
  simulatedStartingCapital: number;
  simulatedEndingCapital: number;
  simulatedProfit: number;
  simulatedTotalReturnPercent: number;

  // Visual distribution
  distribution: ReturnDistributionTier[];
}

export interface StrategyPreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  criteria: BacktestCriteria;
}

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    id: "high_gmp_momentum",
    name: "High GMP Momentum",
    description: "Focus on listings where grey market expected premium is above 25% with solid institutional backing.",
    badge: "High Return",
    criteria: {
      minGmpPercent: 25,
      minQibSubscription: 10,
      minRetailSubscription: 0,
      minTotalSubscription: 0,
      board: "all",
    },
  },
  {
    id: "institutional_conviction",
    name: "Institutional Conviction",
    description: "Follow smart money. Only mainboard issues with massive QIB oversubscription (≥25x).",
    badge: "Low Risk",
    criteria: {
      minGmpPercent: 10,
      minQibSubscription: 25,
      minRetailSubscription: 0,
      minTotalSubscription: 15,
      board: "mainboard",
    },
  },
  {
    id: "sme_multibagger",
    name: "SME Multibagger Hunt",
    description: "High-octane SME issues with aggressive GMP sentiment (≥40%) and heavy demand.",
    badge: "High Growth",
    criteria: {
      minGmpPercent: 40,
      minQibSubscription: 5,
      minRetailSubscription: 10,
      minTotalSubscription: 20,
      board: "sme",
    },
  },
  {
    id: "conservative_mainboard",
    name: "Conservative Bluechip",
    description: "Well-established mainboard issues with issue size ≥ ₹1,000 Cr and healthy retail & QIB demand.",
    badge: "Defensive",
    criteria: {
      minGmpPercent: 10,
      minQibSubscription: 10,
      minRetailSubscription: 2,
      minTotalSubscription: 5,
      board: "mainboard",
      minIssueSizeCr: 1000,
    },
  },
  {
    id: "all_weather",
    name: "All-Weather Filter",
    description: "Balanced risk-reward filter with baseline 15% GMP and 5x total subscription.",
    badge: "Balanced",
    criteria: {
      minGmpPercent: 15,
      minQibSubscription: 5,
      minRetailSubscription: 3,
      minTotalSubscription: 5,
      board: "all",
    },
  },
];

export function runBacktest(
  criteria: BacktestCriteria,
  startingCapital = 100000,
  allocationPerIpo = 15000
): StrategySimulationResult {
  const all = HISTORICAL_IPOS;

  // Filter based on criteria
  const matched = all.filter((ipo) => {
    if (criteria.board !== "all" && ipo.board !== criteria.board) {
      return false;
    }
    if (ipo.gmpPercent < criteria.minGmpPercent) {
      return false;
    }
    if (ipo.subscription.qib < criteria.minQibSubscription) {
      return false;
    }
    if (ipo.subscription.retail < criteria.minRetailSubscription) {
      return false;
    }
    if (ipo.subscription.total < criteria.minTotalSubscription) {
      return false;
    }
    if (
      criteria.minIssueSizeCr !== undefined &&
      ipo.issueSizeCr < criteria.minIssueSizeCr
    ) {
      return false;
    }
    if (
      criteria.maxIssueSizeCr !== undefined &&
      ipo.issueSizeCr > criteria.maxIssueSizeCr
    ) {
      return false;
    }
    if (
      criteria.sector &&
      !ipo.sector.toLowerCase().includes(criteria.sector.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // Calculate benchmark metrics (entire dataset)
  const benchWins = all.filter((i) => i.listingGainPercent > 0).length;
  const benchWinRate = Math.round((benchWins / all.length) * 1000) / 10;
  const benchAvgGain =
    Math.round(
      (all.reduce((sum, i) => sum + i.listingGainPercent, 0) / all.length) * 10
    ) / 10;

  if (matched.length === 0) {
    return {
      criteria,
      totalHistoricalIpos: all.length,
      matchedCount: 0,
      matchedIpos: [],
      winCount: 0,
      lossCount: 0,
      neutralCount: 0,
      winRatePercent: 0,
      avgListingGainPercent: 0,
      medianListingGainPercent: 0,
      maxGainPercent: 0,
      maxLossPercent: 0,
      benchmarkTotalIpos: all.length,
      benchmarkWinRatePercent: benchWinRate,
      benchmarkAvgGainPercent: benchAvgGain,
      alphaVsBenchmark: -benchAvgGain,
      simulatedStartingCapital: startingCapital,
      simulatedEndingCapital: startingCapital,
      simulatedProfit: 0,
      simulatedTotalReturnPercent: 0,
      distribution: [
        { range: "Negative (< 0%)", count: 0, percentage: 0, color: "#f43f5e" },
        { range: "0% to 15%", count: 0, percentage: 0, color: "#eab308" },
        { range: "15% to 50%", count: 0, percentage: 0, color: "#10b981" },
        { range: "50% to 100%", count: 0, percentage: 0, color: "#06b6d4" },
        { range: "Multibagger (> 100%)", count: 0, percentage: 0, color: "#8b5cf6" },
      ],
    };
  }

  // Sort matched by listing date ascending for chronological simulation
  const sorted = [...matched].sort((a, b) =>
    a.listingDate.localeCompare(b.listingDate)
  );

  const wins = sorted.filter((i) => i.listingGainPercent > 0).length;
  const losses = sorted.filter((i) => i.listingGainPercent < 0).length;
  const neutrals = sorted.filter((i) => i.listingGainPercent === 0).length;
  const winRate = Math.round((wins / sorted.length) * 1000) / 10;

  const totalGainSum = sorted.reduce((acc, i) => acc + i.listingGainPercent, 0);
  const avgGain = Math.round((totalGainSum / sorted.length) * 10) / 10;

  // Median
  const gainSorted = [...sorted].sort(
    (a, b) => a.listingGainPercent - b.listingGainPercent
  );
  const mid = Math.floor(gainSorted.length / 2);
  const medianGain =
    gainSorted.length % 2 !== 0
      ? gainSorted[mid].listingGainPercent
      : Math.round(
          ((gainSorted[mid - 1].listingGainPercent +
            gainSorted[mid].listingGainPercent) /
            2) *
            10
        ) / 10;

  const bestIpo = gainSorted[gainSorted.length - 1];
  const worstIpo = gainSorted[0];

  // Capital simulation
  let simulatedProfit = 0;
  for (const ipo of sorted) {
    const profitOnTrade = allocationPerIpo * (ipo.listingGainPercent / 100);
    simulatedProfit += profitOnTrade;
  }
  const simulatedEndingCapital = startingCapital + simulatedProfit;
  const simulatedTotalReturnPercent =
    Math.round((simulatedProfit / startingCapital) * 1000) / 10;

  // Return Distribution
  const neg = sorted.filter((i) => i.listingGainPercent < 0).length;
  const low = sorted.filter(
    (i) => i.listingGainPercent >= 0 && i.listingGainPercent < 15
  ).length;
  const midGain = sorted.filter(
    (i) => i.listingGainPercent >= 15 && i.listingGainPercent < 50
  ).length;
  const highGain = sorted.filter(
    (i) => i.listingGainPercent >= 50 && i.listingGainPercent <= 100
  ).length;
  const megaGain = sorted.filter((i) => i.listingGainPercent > 100).length;

  const distribution: ReturnDistributionTier[] = [
    {
      range: "Negative (< 0%)",
      count: neg,
      percentage: Math.round((neg / sorted.length) * 100),
      color: "#f43f5e",
    },
    {
      range: "0% to 15%",
      count: low,
      percentage: Math.round((low / sorted.length) * 100),
      color: "#eab308",
    },
    {
      range: "15% to 50%",
      count: midGain,
      percentage: Math.round((midGain / sorted.length) * 100),
      color: "#10b981",
    },
    {
      range: "50% to 100%",
      count: highGain,
      percentage: Math.round((highGain / sorted.length) * 100),
      color: "#06b6d4",
    },
    {
      range: "Multibagger (> 100%)",
      count: megaGain,
      percentage: Math.round((megaGain / sorted.length) * 100),
      color: "#8b5cf6",
    },
  ];

  return {
    criteria,
    totalHistoricalIpos: all.length,
    matchedCount: sorted.length,
    matchedIpos: sorted,
    winCount: wins,
    lossCount: losses,
    neutralCount: neutrals,
    winRatePercent: winRate,
    avgListingGainPercent: avgGain,
    medianListingGainPercent: medianGain,
    maxGainPercent: bestIpo?.listingGainPercent ?? 0,
    maxLossPercent: worstIpo?.listingGainPercent ?? 0,
    bestIpo,
    worstIpo,
    benchmarkTotalIpos: all.length,
    benchmarkWinRatePercent: benchWinRate,
    benchmarkAvgGainPercent: benchAvgGain,
    alphaVsBenchmark: Math.round((avgGain - benchAvgGain) * 10) / 10,
    simulatedStartingCapital: startingCapital,
    simulatedEndingCapital: Math.round(simulatedEndingCapital),
    simulatedProfit: Math.round(simulatedProfit),
    simulatedTotalReturnPercent,
    distribution,
  };
}

export function exportBacktestToCsv(result: StrategySimulationResult): string {
  const headers = [
    "Name",
    "Symbol",
    "Board",
    "Sector",
    "Listing Date",
    "Issue Price (INR)",
    "Listing Price (INR)",
    "Listing Gain (%)",
    "GMP at Close (INR)",
    "GMP (%)",
    "Issue Size (Cr)",
    "QIB Subscription (x)",
    "NII Subscription (x)",
    "Retail Subscription (x)",
    "Total Subscription (x)",
  ];

  const rows = result.matchedIpos.map((i) => [
    `"${i.name.replace(/"/g, '""')}"`,
    i.symbol,
    i.board.toUpperCase(),
    `"${i.sector.replace(/"/g, '""')}"`,
    i.listingDate,
    i.issuePrice,
    i.listingPrice,
    `${i.listingGainPercent}%`,
    i.gmp,
    `${i.gmpPercent}%`,
    i.issueSizeCr,
    i.subscription.qib,
    i.subscription.nii,
    i.subscription.retail,
    i.subscription.total,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
