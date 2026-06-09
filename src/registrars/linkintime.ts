// src/registrars/linkintime.ts
// Link Intime Registrar Adapter — Stub (not yet implemented)
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";

export class LinkInTimeAdapter implements RegistrarAdapter {
  readonly name = "linkintime";
  readonly displayName = "Link Intime India Pvt. Ltd.";

  async getActiveIPOs(): Promise<IPO[]> {
    // TODO: Implement Link Intime API integration
    return [];
  }

  async checkAllotment(_pan: string, _clientId: string): Promise<AllotmentResult> {
    return { pan: _pan, status: "error", error: "Link Intime integration not yet implemented." };
  }

  async checkBulkAllotment(pans: string[], _clientId: string): Promise<AllotmentResult[]> {
    return pans.map((pan) => ({ pan, status: "error" as const, error: "Link Intime integration not yet implemented." }));
  }
}
