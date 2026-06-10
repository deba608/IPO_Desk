// src/services/registrar.service.ts
import { RegistrarAdapter } from "@/registrars/adapter.interface";
import { KFinTechAdapter } from "@/registrars/kfintech";
import { LinkInTimeAdapter } from "@/registrars/linkintime";
import { BigShareAdapter } from "@/registrars/bigshare";
import { MUFGAdapter } from "@/registrars/mufg";
import { AllotmentResult, CheckRequest, CheckResponse } from "@/types/allotment.types";
import { findIPOByClientId } from "./ipo.service";

// Registrar registry — add new registrars here
const REGISTRAR_REGISTRY: Record<string, RegistrarAdapter> = {
  kfintech: new KFinTechAdapter(),
  linkintime: new LinkInTimeAdapter(),
  bigshare: new BigShareAdapter(),
  mufg: new MUFGAdapter(),
};

function getAdapter(registrarName: string): RegistrarAdapter {
  const adapter = REGISTRAR_REGISTRY[registrarName];
  if (!adapter) {
    throw new Error(`Unknown registrar: ${registrarName}`);
  }
  return adapter;
}

export async function checkAllotment(request: CheckRequest): Promise<CheckResponse> {
  const { pans, ipoClientId } = request;

  const ipo = await findIPOByClientId(ipoClientId);
  if (!ipo) {
    throw new Error(`IPO not found for clientId: ${ipoClientId}`);
  }

  const adapter = getAdapter(ipo.registrar);
  const results: AllotmentResult[] = await adapter.checkBulkAllotment(pans, ipoClientId);

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
    ipoClientId,
    checkedAt: new Date().toISOString(),
  };
}
