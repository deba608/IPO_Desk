// src/registrars/mufg.ts
// MUFG Intime India (formerly Link Intime) Registrar Adapter — Live
//
// Integration research (verified 2026-06-11):
//   - IPO list:  POST https://in.mpms.mufg.com/Initial_Offer/IPO.aspx/GetDetails
//                body {} → {"d": "<NewDataSet><Table><company_id/><companyname/>…"}
//   - Allotment: POST https://in.mpms.mufg.com/Initial_Offer/IPO.aspx/SearchOnPan
//                body {clientid, PAN, IFSC:"", CHKVAL:"1", token:""}
//                → {"d": "<NewDataSet>…"} ; empty <NewDataSet /> means not found
//   - No authentication, no session cookies, no server-side CAPTCHA.
//     Priority 2 (AJAX endpoint integration) — no Playwright required.

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { log } from "@/services/logger.service";
import {
  bulkCheck,
  findField,
  parseNewDataSetTables,
  withRetry,
} from "./shared";

const MUFG_BASE_URL = "https://in.mpms.mufg.com/Initial_Offer/IPO.aspx";

export class MUFGAdapter implements RegistrarAdapter {
  readonly name: string = "mufg";
  readonly displayName: string = "MUFG Intime India Pvt. Ltd.";

  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 20000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; IPOAllotmentChecker/1.0)",
      },
    });
  }

  async getActiveIPOs(): Promise<IPO[]> {
    const started = Date.now();
    const response = await withRetry(() =>
      this.http.post<{ d: string }>(`${MUFG_BASE_URL}/GetDetails`, {})
    );

    const records = parseNewDataSetTables(response.data?.d ?? "");
    const syncedAt = new Date().toISOString();

    const ipos: IPO[] = [];
    for (const record of records) {
      const clientId = record.company_id?.trim();
      const name = record.companyname?.trim();
      if (clientId && name) {
        ipos.push({
          id: `${this.name}-${clientId}`,
          clientId,
          name,
          registrar: "mufg",
          status: "ACTIVE",
          lastSyncedAt: syncedAt,
        });
      }
    }

    log("info", "ipo_sync_success", `Fetched ${ipos.length} active IPOs from MUFG Intime`, {
      durationMs: Date.now() - started,
      meta: { count: ipos.length, registrar: this.name },
    });
    return ipos;
  }

  async checkAllotment(pan: string, clientId: string): Promise<AllotmentResult> {
    const normalizedPan = pan.toUpperCase().trim();
    const started = Date.now();

    try {
      const response = await withRetry(() =>
        this.http.post<{ d: string }>(`${MUFG_BASE_URL}/SearchOnPan`, {
          clientid: clientId,
          PAN: normalizedPan,
          IFSC: "",
          CHKVAL: "1", // 1 = search by PAN (2 = application no., 3 = DP/client ID)
          token: "",
        })
      );

      const records = parseNewDataSetTables(response.data?.d ?? "");

      log("info", "api_response_time", "MUFG PAN query completed", {
        durationMs: Date.now() - started,
        meta: { clientId, registrar: this.name },
      });

      if (records.length === 0) {
        return { pan: normalizedPan, status: "not_found" };
      }

      const record = records[0];
      // Field names vary slightly across issues; match defensively.
      const name = findField(record, /name/i);
      const allottedRaw = findField(record, /^al+ot/i);
      const appliedRaw = findField(record, /share|appl/i);

      const allottedShares = Number(allottedRaw?.replace(/[^\d.-]/g, ""));
      const appliedShares = Number(appliedRaw?.replace(/[^\d.-]/g, ""));

      if (allottedRaw === undefined || Number.isNaN(allottedShares)) {
        // A record exists but the schema changed — surface as an error
        // rather than guessing the allotment outcome.
        log("warn", "pan_check_failure", "MUFG response had unrecognized fields", {
          meta: { clientId, fields: Object.keys(record).join(",") },
        });
        return {
          pan: normalizedPan,
          name,
          status: "error",
          error: "Registrar returned an unrecognized response format.",
        };
      }

      return {
        pan: normalizedPan,
        name,
        appliedShares: Number.isNaN(appliedShares) ? undefined : appliedShares,
        allottedShares,
        status: allottedShares > 0 ? "allotted" : "not_allotted",
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string };

      log("error", "pan_check_failure", `MUFG PAN check failed: ${err.message ?? "unknown"}`, {
        durationMs: Date.now() - started,
        meta: { clientId, registrar: this.name, httpStatus: err.response?.status ?? "none" },
      });

      if (!err.response) {
        return { pan: normalizedPan, status: "error", error: "Network error. Please try again." };
      }
      if (err.response.status === 429) {
        return {
          pan: normalizedPan,
          status: "error",
          error: "Rate limit exceeded. Please wait before retrying.",
        };
      }
      return {
        pan: normalizedPan,
        status: "error",
        error: `API error: ${err.response.status ?? err.message}`,
      };
    }
  }

  async checkBulkAllotment(pans: string[], clientId: string): Promise<AllotmentResult[]> {
    return bulkCheck(pans, (pan) => this.checkAllotment(pan, clientId));
  }
}

export const mufgAdapter = new MUFGAdapter();
