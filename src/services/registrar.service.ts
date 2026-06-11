// src/services/registrar.service.ts
// Registrar-agnostic allotment check pipeline. The caller never knows which
// registrar serves an IPO: the IPO is resolved from the catalogue, the
// matching adapter is selected from the registry, and every adapter returns
// the same AllotmentResult shape.

import { getAdapter } from "@/registrars/registry";
import { AllotmentResult, CheckRequest, CheckResponse } from "@/types/allotment.types";
import { findIPO } from "./ipo.service";

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

  const summary = {
    total: results.length,
    allotted: results.filter((r) => r.status === "allotted").length,
    notAllotted: results.filter((r) => r.status === "not_allotted").length,
    notFound: results.filter((r) => r.status === "not_found").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  return {
    results,
    summary,
    ipoName: ipo.name,
    ipoClientId: ipo.clientId,
    checkedAt: new Date().toISOString(),
  };
}
