// src/registrars/bigshare.ts
// Bigshare Services Registrar Adapter — Live
//
// Integration research (verified 2026-06-11):
//   - IPO list:  the dropdown on https://ipo.bigshareonline.com/IPO_Status.html
//                is rendered server-side as inline <option value="ID"> tags
//                (retired IPOs are commented out — comments must be stripped).
//                Priority 3 (HTML response parsing); no JSON list endpoint exists.
//   - Allotment: POST https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails
//                body {Applicationno, Company, SelectionType:"PN", PanNo,
//                      txtcsdl, txtDPID, txtClId, ddlType, lang}
//                → {"d": {APPLICATION_NO, DPID, Name, APPLIED, ALLOTED, …}}
//                DPID === "No data found" means PAN not found for that issue.
//                Priority 2 (AJAX endpoint integration).
//   - The page CAPTCHA is generated and validated entirely client-side; it is
//     never sent to the server. No authentication or session cookies required.

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult, BigShareCheckResponse } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { log } from "@/services/logger.service";
import { bulkCheck, withRetry } from "./shared";

const BIGSHARE_STATUS_PAGE = "https://ipo.bigshareonline.com/IPO_Status.html";
const BIGSHARE_CHECK_URL = "https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails";

export class BigShareAdapter implements RegistrarAdapter {
  readonly name = "bigshare";
  readonly displayName = "Bigshare Services Pvt. Ltd.";

  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IPOAllotmentChecker/1.0)",
      },
    });
  }

  async getActiveIPOs(): Promise<IPO[]> {
    const started = Date.now();
    const html = (
      await withRetry(() => this.http.get<string>(BIGSHARE_STATUS_PAGE))
    ).data;

    // Retired IPOs remain in the markup inside HTML comments — drop them first.
    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");

    const selectMatch = withoutComments.match(
      /<select[^>]*id="ddlCompany"[^>]*>([\s\S]*?)<\/select>/i
    );
    if (!selectMatch) {
      throw new Error("Could not locate IPO dropdown on Bigshare status page");
    }

    const syncedAt = new Date().toISOString();
    const ipos: IPO[] = [];
    const optionRe = /<option\s+value="(\d+)"\s*>([^<]+)<\/option>/gi;
    let match: RegExpExecArray | null;
    while ((match = optionRe.exec(selectMatch[1])) !== null) {
      ipos.push({
        id: `${this.name}-${match[1]}`,
        clientId: match[1],
        name: match[2].trim(),
        registrar: "bigshare",
        status: "ACTIVE",
        lastSyncedAt: syncedAt,
      });
    }

    log("info", "ipo_sync_success", `Fetched ${ipos.length} active IPOs from Bigshare`, {
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
        this.http.post<BigShareCheckResponse>(
          BIGSHARE_CHECK_URL,
          {
            Applicationno: "",
            Company: clientId,
            SelectionType: "PN", // PN = search by PAN
            PanNo: normalizedPan,
            txtcsdl: "",
            txtDPID: "",
            txtClId: "",
            ddlType: "",
            lang: "en",
          },
          { headers: { "Content-Type": "application/json; charset=utf-8" } }
        )
      );

      log("info", "api_response_time", "Bigshare PAN query completed", {
        durationMs: Date.now() - started,
        meta: { clientId, registrar: this.name },
      });

      const record = response.data?.d;
      if (!record) {
        return {
          pan: normalizedPan,
          status: "error",
          error: "Registrar returned an unrecognized response format.",
        };
      }

      if (record.DPID === "No data found") {
        return { pan: normalizedPan, status: "not_found" };
      }
      if (record.DPID?.startsWith("Please Enter Valid")) {
        return { pan: normalizedPan, status: "error", error: record.DPID };
      }

      const allottedShares = Number(record.ALLOTED?.replace(/[^\d.-]/g, ""));
      const appliedShares = Number(record.APPLIED?.replace(/[^\d.-]/g, ""));

      if (Number.isNaN(allottedShares)) {
        return {
          pan: normalizedPan,
          name: record.Name || undefined,
          status: "error",
          error: "Registrar returned an unrecognized response format.",
        };
      }

      return {
        pan: normalizedPan,
        name: record.Name || undefined,
        appliedShares: Number.isNaN(appliedShares) ? undefined : appliedShares,
        allottedShares,
        status: allottedShares > 0 ? "allotted" : "not_allotted",
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string };

      log("error", "pan_check_failure", `Bigshare PAN check failed: ${err.message ?? "unknown"}`, {
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

export const bigShareAdapter = new BigShareAdapter();
