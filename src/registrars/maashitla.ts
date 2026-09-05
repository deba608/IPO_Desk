// src/registrars/maashitla.ts
// Maashitla Securities Registrar Adapter — Live (JSON API)
//
// Integration research (verified 2026-09-05 against the public OpenAPI spec
// at https://api.maashitla.com/openapi.json):
//   - IPO list:  GET https://api.maashitla.com/api/public-issue/companies
//                → [{company_id (uuid), company_name}]
//   - Allotment: GET https://api.maashitla.com/api/public-issue/search
//                      ?company_name=<name>&pan=<PAN>
//                → 200 {"company_name", "pan", "application_no",
//                       "dpid_client_id", "name",
//                       "shares_applied", "shares_alloted"}
//                → 404 when no allotment record matches (verified with a
//                dummy PAN). No auth, no CAPTCHA, no cookies.

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { log } from "@/services/logger.service";
import { bulkCheck, withRetry } from "./shared";

const MAASHITLA_API_BASE = "https://api.maashitla.com";

interface MaashitlaCompany {
  company_id: string;
  company_name: string;
}

interface MaashitlaAllotment {
  company_name: string;
  pan: string;
  application_no: string;
  dpid_client_id: string;
  name: string;
  shares_applied: number;
  shares_alloted: number;
}

// clientId (uuid) → company_name, so PAN checks don't re-fetch the company
// list for every PAN in a bulk upload. Short TTL; the sync layer already
// refreshes the catalogue every 5 minutes.
const COMPANY_CACHE_TTL_MS = 5 * 60 * 1000;
let companyCache: { at: number; byId: Map<string, string> } = {
  at: 0,
  byId: new Map(),
};

export class MaashitlaAdapter implements RegistrarAdapter {
  readonly name = "maashitla";
  readonly displayName = "Maashitla Securities Pvt. Ltd.";

  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 15000,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
  }

  private async fetchCompanies(): Promise<MaashitlaCompany[]> {
    const response = await withRetry(() =>
      this.http.get<MaashitlaCompany[]>(
        `${MAASHITLA_API_BASE}/api/public-issue/companies`
      )
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  async getActiveIPOs(): Promise<IPO[]> {
    const started = Date.now();
    const companies = await this.fetchCompanies();

    const syncedAt = new Date().toISOString();
    const ipos: IPO[] = [];
    for (const c of companies) {
      if (c?.company_id && c?.company_name) {
        ipos.push({
          id: `${this.name}-${c.company_id}`,
          clientId: c.company_id,
          name: c.company_name.trim(),
          registrar: "maashitla",
          status: "ACTIVE",
          lastSyncedAt: syncedAt,
        });
      }
    }

    companyCache = {
      at: Date.now(),
      byId: new Map(ipos.map((ipo) => [ipo.clientId, ipo.name])),
    };

    log("info", "ipo_sync_success", `Fetched ${ipos.length} active IPOs from Maashitla`, {
      durationMs: Date.now() - started,
      meta: { count: ipos.length, registrar: this.name },
    });
    return ipos;
  }

  /** Resolve a company uuid to the company_name the search endpoint needs. */
  private async resolveCompanyName(companyId: string): Promise<string | null> {
    const cached = companyCache.byId.get(companyId);
    if (cached && Date.now() - companyCache.at < COMPANY_CACHE_TTL_MS) {
      return cached;
    }
    // The caller may pass a company_name directly (forward-compatible).
    if (!/^[0-9a-f-]{32,36}$/i.test(companyId)) return companyId;
    try {
      const companies = await this.fetchCompanies();
      companyCache = {
        at: Date.now(),
        byId: new Map(
          companies
            .filter((c) => c?.company_id && c?.company_name)
            .map((c) => [c.company_id, c.company_name.trim()])
        ),
      };
    } catch {
      // Fall through to the null below — the check reports an error.
    }
    return companyCache.byId.get(companyId) ?? null;
  }

  async checkAllotment(pan: string, clientId: string): Promise<AllotmentResult> {
    const normalizedPan = pan.toUpperCase().trim();
    const started = Date.now();

    const companyName = await this.resolveCompanyName(clientId);
    if (!companyName) {
      return {
        pan: normalizedPan,
        status: "error",
        error: "Unknown company for this registrar. Please refresh the IPO list and retry.",
      };
    }

    try {
      const response = await withRetry(() =>
        this.http.get<MaashitlaAllotment>(
          `${MAASHITLA_API_BASE}/api/public-issue/search`,
          { params: { company_name: companyName, pan: normalizedPan } }
        )
      );

      log("info", "api_response_time", "Maashitla PAN query completed", {
        durationMs: Date.now() - started,
        meta: { clientId, registrar: this.name },
      });

      const record = response.data ?? {};
      const allottedShares = Number(record.shares_alloted ?? 0);
      const appliedShares = Number(record.shares_applied);

      if (!Number.isFinite(allottedShares)) {
        log("warn", "pan_check_failure", "Maashitla response had unusable share counts", {
          meta: { clientId, registrar: this.name },
        });
        return {
          pan: normalizedPan,
          name: record.name || undefined,
          status: "error",
          error: "Registrar returned an unrecognized response format.",
        };
      }

      return {
        pan: record.pan || normalizedPan,
        name: record.name || undefined,
        appliedShares: Number.isFinite(appliedShares) ? appliedShares : undefined,
        allottedShares,
        status: allottedShares > 0 ? "allotted" : "not_allotted",
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown }; message?: string };

      // 404 = the API's not-found signal (verified); never surface as error.
      if (
        err.response?.status === 404 ||
        (err.response?.data &&
          /NO_ALLOTMENT_FOUND|no\s*record|not\s*found/i.test(JSON.stringify(err.response.data)))
      ) {
        log("info", "api_response_time", "Maashitla PAN query completed (not found)", {
          durationMs: Date.now() - started,
          meta: { clientId, registrar: this.name },
        });
        return { pan: normalizedPan, status: "not_found" };
      }

      log("error", "pan_check_failure", `Maashitla PAN check failed: ${err.message ?? "unknown"}`, {
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

export const maashitlaAdapter = new MaashitlaAdapter();
