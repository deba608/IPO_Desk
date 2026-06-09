// src/registrars/mufg.ts
// MUFG (formerly Karvy) Registrar Adapter — Stub
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";

export class MUFGAdapter implements RegistrarAdapter {
  readonly name = "mufg";
  readonly displayName = "MUFG Intime India Pvt. Ltd.";

  async getActiveIPOs(): Promise<IPO[]> {
    return [];
  }

  async checkAllotment(_pan: string, _clientId: string): Promise<AllotmentResult> {
    return { pan: _pan, status: "error", error: "MUFG integration not yet implemented." };
  }

  async checkBulkAllotment(pans: string[], _clientId: string): Promise<AllotmentResult[]> {
    return pans.map((pan) => ({ pan, status: "error" as const, error: "MUFG integration not yet implemented." }));
  }
}
