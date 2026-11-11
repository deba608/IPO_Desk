// src/registrars/integrated-registry.ts
// Integrated Registry (IRMS) Registrar Adapter
//
// NOTE (issue #7): the live site referenced in the issue
//   https://www.integratedregistry.in/IRMS_V2/IPO.aspx
//   (and https://ipo.cameoindia.com/ in the same thread)
// could not be reached during this session, so the exact request/response
// field names below are NOT verified against the live registrar.
//
// They follow the same ASP.NET WebMethods pattern used by the MUFG / Link
// Intime adapter (GetDetails / SearchOnPan returning XML inside the JSON `d`)
// and MUST be confirmed against the live Integrated Registry endpoints before
// this adapter produces correct results.
//
// Assumed endpoints (ASP.NET WebMethods):
//   - IPO list:   POST {base}/GetDetails      → {"d": "<NewDataSet><Table>…</Table></NewDataSet>"}
//   - Allotment:  POST {base}/SearchOnPan     → {"d": "<NewDataSet>…"}; empty result => PAN not found

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { log } from "@/services/logger.service";
import { bulkCheck, findField, parseNewDataSetTables, withRetry } from "./shared";

const INTEGRATED_REGISTRY_BASE_URL = "https://www.integratedregistry.in/IRMS_V2/IPO.aspx";

export class IntegratedRegistryAdapter implements RegistrarAdapter {
  readonly name = "integratedregistry";
  readonly displayName = "Integrated Registry (IRMS)";

  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 20000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
  }

  async getActiveIPOs(): Promise<IPO[]> {
    const started = Date.now();
    const response = await withRetry(() =>
      this.http.post<{ d: string }>(`${INTEGRATED_REGISTRY_BASE_URL}/GetDetails`, {})
    );

    const records = parseNewDataSetTables(response.data?.d ?? "");
    const syncedAt = new Date().toISOString();

    const ipos: IPO[] = [];
    for (const record of records) {
      // Field names vary across IRMS versions — match defensively.
      const clientId =
        record.company_id?.trim() ??
        record.CompanionId?.trim() ??
        record.IPOId?.trim() ??
        record.id?.trim();
      const name =
        record.companyname?.trim() ??
        record.companyName?.trim() ??
        record.ipoName?.trim() ??
        record.name?.trim();
      if (clientId && name) {
        ipos.push({
          id: `${this.name}-${clientId}`,
          clientId,
          name,
          registrar: "integratedregistry",
          status: "ACTIVE",
          lastSyncedAt: syncedAt,
        });
      }
    }

    log("info", "ipo_sync_success", `Fetched ${ipos.length} active IPOs from Integrated Registry`, {
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
        this.http.post<{ d: string }>(`${INTEGRATED_REGISTRY_BASE_URL}/SearchOnPan`, {
          clientid: clientId,
          PAN: normalizedPan,
          IFSC: "",
          CHKVAL: "1", // 1 = search by PAN
          token: "",
        })
      );

      const records = parseNewDataSetTables(response.data?.d ?? "");

      log("info", "api_response_time", "Integrated Registry PAN query completed", {
        durationMs: Date.now() - started,
        meta: { clientId, registrar: this.name },
      });

      if (records.length === 0) {
        return { pan: normalizedPan, status: "not_found" };
      }

      const record = records[0];
      // Field names vary across issues; match defensively.
      const name = findField(record, /name/i);
      const allottedKey = Object.keys(record).find((k) => /^al+ot/i.test(k));
      const appliedKey = Object.keys(record).find(
        (k) => k !== allottedKey && /share|appl/i.test(k)
      );
      const allottedRaw = allottedKey !== undefined ? record[allottedKey] : undefined;
      const appliedRaw = appliedKey !== undefined ? record[appliedKey] : undefined;

      const allottedShares = Number(allottedRaw?.replace(/[^\d.-]/g, ""));
      const appliedShares = Number(appliedRaw?.replace(/[^\d.-]/g, ""));

      if (allottedRaw === undefined || Number.isNaN(allottedShares)) {
        // A record exists but the schema changed — surface as an error rather
        // than guessing the allotment outcome.
        log("warn", "pan_check_failure", "Integrated Registry response had unrecognized fields", {
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

      log("error", "pan_check_failure", `Integrated Registry PAN check failed: ${err.message ?? "unknown"}`, {
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

export const integratedRegistryAdapter = new IntegratedRegistryAdapter();
