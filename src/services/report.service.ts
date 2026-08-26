import type { CalendarIPOWithStatus } from "@/types/calendar.types";

export interface ReportSection {
  title: string;
  content: string;
  score?: number;
  maxScore?: number;
}

export interface ResearchReport {
  ipoId: string;
  ipoName: string;
  generatedAt: string;
  sections: ReportSection[];
  overallScore: number;
  verdict: "strong_apply" | "apply" | "apply_listing" | "neutral" | "avoid";
  verdictLabel: string;
  disclaimer: string;
}

// gmpPercent can be missing/NaN when gmp is set but the price band max is 0 —
// never trust the non-null assertion downstream.
function safeGmpPercent(ipo: CalendarIPOWithStatus): number | undefined {
  return typeof ipo.gmpPercent === "number" && Number.isFinite(ipo.gmpPercent)
    ? ipo.gmpPercent
    : undefined;
}

function generateVerdict(score: number): {
  verdict: ResearchReport["verdict"];
  label: string;
} {
  if (score >= 80) return { verdict: "strong_apply", label: "Strong Apply" };
  if (score >= 65) return { verdict: "apply", label: "Apply" };
  if (score >= 50) return { verdict: "apply_listing", label: "Apply for Listing Gains" };
  if (score >= 35) return { verdict: "neutral", label: "Neutral" };
  return { verdict: "avoid", label: "Avoid" };
}

function assessFinancialHealth(ipo: CalendarIPOWithStatus): ReportSection {
  // Derive financial health indicators from available data
  const hasSubscription = ipo.subscription !== undefined;
  const subHealthy =
    ipo.subscription && ipo.subscription.total
      ? ipo.subscription.total >= 3
      : false;
  const gmpHealthy = ipo.gmpPercent !== undefined ? ipo.gmpPercent >= 15 : false;

  const score = (hasSubscription ? 20 : 0) + (subHealthy ? 40 : 20) + (gmpHealthy ? 40 : 20);

  const points: string[] = [
    `Issue size of ${ipo.issueSizeCr} Cr suggests ${ipo.issueSizeCr > 1000 ? "a large" : ipo.issueSizeCr > 200 ? "a mid-sized" : "a small"} offering.`,
  ];

  if (ipo.subscription?.total) {
    points.push(
      `Overall subscription of ${ipo.subscription.total}x indicates ${ipo.subscription.total > 10 ? "very strong" : ipo.subscription.total > 3 ? "healthy" : "moderate"} investor demand.`
    );
  } else {
    points.push("Subscription data will appear once the issue opens.");
  }

  if (ipo.gmp !== undefined) {
    const pct = safeGmpPercent(ipo);
    points.push(
      pct !== undefined
        ? `Current grey-market premium of ₹${ipo.gmp} (${pct}%) signals ${pct >= 20 ? "strong" : pct >= 10 ? "positive" : "mild"} market sentiment.`
        : `Current grey-market premium of ₹${ipo.gmp}.`
    );
  }

  return {
    title: "Financial Health & Demand",
    content: points.join(" "),
    score,
    maxScore: 100,
  };
}

function assessValuation(ipo: CalendarIPOWithStatus): ReportSection {
  const pb = ipo.priceBand;
  const range = pb.max - pb.min;
  const rangePercent = pb.min > 0 ? (range / pb.min) * 100 : 0;

  // Narrower band = more confidence in pricing
  const score = rangePercent <= 5 ? 75 : rangePercent <= 10 ? 60 : 45;

  const points = [
    `Price band set at ₹${pb.min}–${pb.max} per share, a ${rangePercent.toFixed(0)}% range.`,
    `Minimum retail investment of ₹${ipo.minInvestment.toLocaleString("en-IN")}.`,
  ];

  if (ipo.leadManagers.length > 0) {
    points.push(`Lead managed by ${ipo.leadManagers.join(", ")}.`);
  }

  return {
    title: "Valuation Analysis",
    content: points.join(" "),
    score,
    maxScore: 100,
  };
}

function assessMarketSentiment(ipo: CalendarIPOWithStatus): ReportSection {
  const points: string[] = [];
  let score = 50;

  if (ipo.subscription) {
    const { qib, nii, retail, total } = ipo.subscription;
    if (qib !== undefined) {
      points.push(`QIB portion subscribed ${qib}x — ${qib > 5 ? "institutional confidence is strong" : qib > 1 ? "adequate institutional interest" : "institutional demand is muted"}.`);
      if (qib > 5) score += 15;
      else if (qib > 1) score += 5;
    }
    if (nii !== undefined) {
      points.push(`NII portion subscribed ${nii}x reflecting ${nii > 10 ? "very high" : nii > 3 ? "good" : "moderate"} high-net-worth interest.`);
      if (nii > 10) score += 15;
      else if (nii > 3) score += 5;
    }
    if (retail !== undefined) {
      points.push(`Retail portion subscribed ${retail}x indicating ${retail > 5 ? "strong" : retail > 1 ? "decent" : "subdued"} retail participation.`);
      if (retail > 5) score += 10;
      else if (retail > 1) score += 5;
    }
    if (total !== undefined) {
      points.push(`Overall subscription of ${total}x.`);
    }
  }

  const gmpPct = safeGmpPercent(ipo);
  if (ipo.gmp !== undefined) {
    points.push(
      gmpPct !== undefined
        ? `GMP of ₹${ipo.gmp} (${gmpPct}%) implies an estimated listing price of ₹${ipo.priceBand.max + ipo.gmp}.`
        : `GMP of ₹${ipo.gmp} over the cap price of ₹${ipo.priceBand.max}.`
    );
    if (gmpPct !== undefined) {
      if (gmpPct >= 30) score += 10;
      else if (gmpPct >= 15) score += 5;
    }
  }

  return {
    title: "Market Sentiment",
    content: points.join(" "),
    score: Math.min(score, 100),
    maxScore: 100,
  };
}

function assessRisk(ipo: CalendarIPOWithStatus): ReportSection {
  const points: string[] = [];
  let riskScore = 30; // lower = higher risk (inverted)

  if (ipo.board === "sme") {
    points.push("SME IPO — these carry higher volatility and lower liquidity compared to mainboard issues.");
    riskScore += 20;
  } else {
    points.push("Mainboard IPO — regulated by SEBI with higher disclosure standards.");
    riskScore += 40;
  }

  if (ipo.subscription?.total === undefined || ipo.subscription.total < 1) {
    points.push("Subscription data not yet available — demand visibility is limited.");
    riskScore += 20;
  } else if (ipo.subscription.total > 10) {
    points.push("High subscription levels reduce risk of undersubscription but may mean lower allotment ratios.");
    riskScore += 30;
  } else {
    riskScore += 25;
  }

  if (ipo.gmpPercent !== undefined && ipo.gmpPercent < 0) {
    points.push("Negative GMP suggests bearish grey-market sentiment.");
    riskScore += 10;
  }

  return {
    title: "Risk Assessment",
    content: points.join(" "),
    score: riskScore,
    maxScore: 100,
  };
}

export function generateReport(ipo: CalendarIPOWithStatus): ResearchReport {
  const sections = [
    assessFinancialHealth(ipo),
    assessValuation(ipo),
    assessMarketSentiment(ipo),
    assessRisk(ipo),
  ];

  // Average over scored sections only — "Business Overview" carries no score
  // and must not deflate the overall result.
  const scored = sections.filter((s) => typeof s.score === "number");
  const overallScore = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + (s.score ?? 0), 0) / scored.length)
    : 0;

  const { verdict, label } = generateVerdict(overallScore);

  return {
    ipoId: ipo.id,
    ipoName: ipo.name,
    generatedAt: new Date().toISOString(),
    sections: [
      {
        title: "Business Overview",
        content: `${ipo.name} is a ${ipo.board === "mainboard" ? "mainboard" : "SME"} IPO with an issue size of ${ipo.issueSizeCr > 0 ? `₹${ipo.issueSizeCr} Cr` : "to be announced"}. The issue will be available for subscription from ${ipo.openDate} to ${ipo.closeDate}${ipo.listingDate ? `, with listing expected on ${ipo.listingDate}` : ""}.`,
        score: undefined,
      },
      ...sections,
    ],
    overallScore,
    verdict,
    verdictLabel: label,
    disclaimer: "This analysis is generated algorithmically from available data. It is not investment advice. Please consult a registered financial advisor before making investment decisions.",
  };
}
