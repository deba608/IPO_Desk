// src/services/registrar.service.ts
// Registrar-agnostic allotment check pipeline. The caller never knows which
// registrar serves an IPO: the IPO is resolved from the catalogue, the
// matching adapter is selected from the registry, and every adapter returns
// the same AllotmentResult shape.

import { getAdapter } from "@/registrars/registry";
import {
  AllotmentResult,
  CheckRequest,
  CheckResponse,
  ScanIPOResult,
  ScanRequest,
  ScanResponse,
} from "@/types/allotment.types";
import { findIPO, getActiveIPOs } from "./ipo.service";

/** Runs `task` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function summarize(results: AllotmentResult[]) {
  return {
    total: results.length,
    allotted: results.filter((r) => r.status === "allotted").length,
    notAllotted: results.filter((r) => r.status === "not_allotted").length,
    notFound: results.filter((r) => r.status === "not_found").length,
    errors: results.filter((r) => r.status === "error").length,
  };
}

export async function checkAllotment(request: CheckRequest): Promise<CheckResponse> {
  const { pans, ipoClientId } = request;

  const ipo = await findIPO(ipoClientId);
  if (!ipo) {
    throw new Error(`IPO not found for id: ${ipoClientId}`);
  }

  const adapter = getAdapter(ipo.registrar);
  // Adapters always receive the registrar-native clientId, even when the
  // caller sent the namespaced id.
  const results: AllotmentResult[] = await adapter.checkBulkAllotment(pans, ipo.clientId);

  return {
    results,
    summary: summarize(results),
    ipoName: ipo.name,
    ipoClientId: ipo.clientId,
    checkedAt: new Date().toISOString(),
  };
}

/** Concurrent registrar fan-out: limits IPOs checked in parallel. */
const SCAN_CONCURRENCY = 5;

/**
 * Checks the same PAN set against every active IPO (optionally one registrar).
 * Returns only the IPOs a PAN actually applied to — i.e. at least one result is
 * "allotted" or "not_allotted"; pure "not_found" IPOs are dropped as noise.
 * Per-IPO failures are isolated: an adapter error marks that IPO's PANs as
 * "error" rather than aborting the whole scan.
 */
export async function scanAllotment(request: ScanRequest): Promise<ScanResponse> {
  const { pans, registrar } = request;

  const { ipos: active } = await getActiveIPOs();
  const targets = registrar
    ? active.filter((ipo) => ipo.registrar === registrar)
    : active;

  const perIPO = await mapWithConcurrency(
    targets,
    SCAN_CONCURRENCY,
    async (ipo): Promise<ScanIPOResult> => {
      const adapter = getAdapter(ipo.registrar);
      let results: AllotmentResult[];
      try {
        results = await adapter.checkBulkAllotment(pans, ipo.clientId);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Check failed";
        results = pans.map((pan) => ({ pan, status: "error" as const, error: msg }));
      }
      return {
        ipoId: ipo.id,
        ipoName: ipo.name,
        registrar: ipo.registrar,
        results,
        summary: summarize(results),
      };
    }
  );

  // Keep only IPOs the PAN(s) applied to; rank most allotments first.
  const hits = perIPO
    .filter((r) => r.summary.allotted > 0 || r.summary.notAllotted > 0)
    .sort((a, b) => b.summary.allotted - a.summary.allotted);

  return {
    ipos: hits,
    scanned: targets.length,
    pansChecked: pans.length,
    iposWithAllotment: hits.filter((r) => r.summary.allotted > 0).length,
    totalAllotted: hits.reduce((sum, r) => sum + r.summary.allotted, 0),
    errors: perIPO.reduce((sum, r) => sum + r.summary.errors, 0),
    checkedAt: new Date().toISOString(),
  };
}
