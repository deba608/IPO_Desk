// src/registrars/adapter.interface.ts
import { AllotmentResult } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";

export interface RegistrarAdapter {
  /** Unique identifier for the registrar */
  readonly name: string;

  /** Human-readable label */
  readonly displayName: string;

  /**
   * Fetch active IPOs managed by this registrar
   */
  getActiveIPOs(): Promise<IPO[]>;

  /**
   * Check allotment status for a single PAN
   * @param pan - Validated PAN number (10 chars, uppercase)
   * @param ipoClientId - Registrar-specific IPO identifier
   */
  checkAllotment(pan: string, ipoClientId: string): Promise<AllotmentResult>;

  /**
   * Check allotment for multiple PANs concurrently
   * @param pans - Array of validated PAN numbers
   * @param ipoClientId - Registrar-specific IPO identifier
   */
  checkBulkAllotment(
    pans: string[],
    ipoClientId: string
  ): Promise<AllotmentResult[]>;
}
