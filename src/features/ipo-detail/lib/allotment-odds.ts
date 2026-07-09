// Retail IPO allotment probability math.
//
// In India, when the retail portion is oversubscribed, allotment is a lottery:
// each application (at the minimum 1 lot) either wins exactly 1 lot or nothing.
// The per-application win probability is ~1 / retailSubscription. So a 15×
// retail subscription means roughly a 1-in-15 chance per application.
//
// For N independent applications (different PANs), the chance of landing at
// least one lot is 1 − (1 − p)^N, and the expected number of lots is N × p.
// These are the standard approximations investors use; real registrar lotteries
// round to whole lots and can allot proportionally at low oversubscription, so
// we label the output as an estimate.

export interface AllotmentOdds {
  /** Retail subscription multiple this is based on (×). */
  retailSubscription: number;
  /** Win probability per single application (0–1). */
  perApplication: number;
  /** Human "1 in N" framing (N = round(1/perApplication)). */
  oneInN: number;
  /** True when retail is undersubscribed → effectively full allotment. */
  fullAllotment: boolean;
}

/** Derive per-application odds from the retail subscription multiple. */
export function computeOdds(retailSubscription: number): AllotmentOdds {
  const sub = Math.max(0, retailSubscription);
  // At/under 1× everyone who applied gets their lot.
  if (sub <= 1) {
    return {
      retailSubscription: sub,
      perApplication: 1,
      oneInN: 1,
      fullAllotment: true,
    };
  }
  const perApplication = 1 / sub;
  return {
    retailSubscription: sub,
    perApplication,
    oneInN: Math.round(sub),
    fullAllotment: false,
  };
}

/** Chance (0–1) of at least one lot across `n` independent applications. */
export function chanceOfAtLeastOne(perApplication: number, n: number): number {
  if (n <= 0) return 0;
  if (perApplication >= 1) return 1;
  return 1 - Math.pow(1 - perApplication, n);
}

/** Expected whole lots won across `n` applications (may be fractional). */
export function expectedLots(perApplication: number, n: number): number {
  return Math.max(0, n) * perApplication;
}

/**
 * Smallest number of applications needed to reach `target` confidence (0–1) of
 * winning at least one lot. Returns 1 when a single application already clears
 * the bar (full allotment), or Infinity if odds are zero.
 */
export function applicationsForConfidence(
  perApplication: number,
  target = 0.9
): number {
  if (perApplication >= 1) return 1;
  if (perApplication <= 0) return Infinity;
  const t = Math.min(Math.max(target, 0), 0.999);
  // n such that 1 − (1−p)^n ≥ t  →  n ≥ ln(1−t) / ln(1−p)
  return Math.ceil(Math.log(1 - t) / Math.log(1 - perApplication));
}
