// src/registrars/bigshare.ts
// Bigshare Services Registrar Adapter — Stub
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";

export class BigShareAdapter implements RegistrarAdapter {
  readonly name = "bigshare";
  readonly displayName = "Bigshare Services Pvt. Ltd.";

  async getActiveIPOs(): Promise<IPO[]> {
    return [];
  }

  async checkAllotment(_pan: string, _clientId: string): Promise<AllotmentResult> {
    return { pan: _pan, status: "error", error: "Bigshare integration not yet implemented." };
  }

  async checkBulkAllotment(pans: string[], _clientId: string): Promise<AllotmentResult[]> {
    return pans.map((pan) => ({ pan, status: "error" as const, error: "Bigshare integration not yet implemented." }));
  }
}
