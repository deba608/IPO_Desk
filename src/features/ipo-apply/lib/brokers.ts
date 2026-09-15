// Broker deep-links + PAN helpers for the multi-account apply workspace.
// All URLs are public IPO pages (no auth). Submission always happens in the
// broker's own app — we only deep-link there.

export type BrokerKey =
  | "zerodha"
  | "groww"
  | "upstox"
  | "angelone"
  | "icicidirect"
  | "hdfc"
  | "kotak"
  | "paytm"
  | "other";

export const BROKERS: Record<BrokerKey, { label: string; applyUrl: string }> = {
  zerodha: { label: "Zerodha Kite", applyUrl: "https://kite.zerodha.com/ipo" },
  groww: { label: "Groww", applyUrl: "https://groww.in/ipos" },
  upstox: { label: "Upstox", applyUrl: "https://upstox.com/ipo/" },
  angelone: { label: "Angel One", applyUrl: "https://www.angelone.in/ipo" },
  icicidirect: { label: "ICICI Direct", applyUrl: "https://www.icicidirect.com/ipo" },
  hdfc: { label: "HDFC Bank / Sky", applyUrl: "https://www.hdfcbank.com/personal/invest/ipo" },
  kotak: { label: "Kotak Securities", applyUrl: "https://www.kotaksecurities.com/ipo/" },
  paytm: { label: "Paytm Money", applyUrl: "https://www.paytmmoney.com/ipo" },
  other: { label: "Other / Bank ASBA", applyUrl: "https://www.bseindia.com/static/publicissue/" },
};

export const BROKER_KEYS = Object.keys(BROKERS) as BrokerKey[];

export function getBrokerApplyUrl(broker: BrokerKey): string {
  return BROKERS[broker]?.applyUrl ?? BROKERS.other.applyUrl;
}

export function getBrokerLabel(broker: BrokerKey): string {
  return BROKERS[broker]?.label ?? BROKERS.other.label;
}

/** SEBI PAN format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F). */
export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase());
}

/** Mask for display: ABCDE1234F → AXXXXX34F (never show full PAN in lists). */
export function maskPan(pan: string): string {
  const p = pan.trim().toUpperCase();
  if (p.length !== 10) return p;
  return `${p[0]}XXXXX${p.slice(6, 8)}X${p[9]}`;
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
