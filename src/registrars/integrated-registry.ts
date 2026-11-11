// src/registrars/integrated-registry.ts
// Integrated Registry (IRMS) Registrar Adapter
//
// EVIDENCE (REA browser capture, 2026-11-11):
//   - Live site: https://www.integratedregistry.in/IRMS_V2/IPO.aspx  (reachable)
//   - ASP.NET WebForms page — form posts back to ./IPO.aspx, has __VIEWSTATE
//   - IPO listing page: https://www.integratedregistry.in/IRMS_V2/IPOListing.aspx
//   - Alternative status host: https://ipostatus.integratedregistry.in/IPOlink_v2.aspx
//   - AJAX library: /IRMS_V2/Scripts/AjaxLoaderV2.js — generic Init_Ajax /
//     InitSmartAjax* wrappers taking (Method, Page, PostData, …); Page is the
//     target URL, PostData is the request body.
//   - XAntiAuthToken header sent on POST, read from #AntiAuthToken element
//   - var Global_Qtid = "0" global variable
//
// NOT YET VERIFIED (could not be determined from passive capture):
//   - Exact POST body fields for the allotment-check form on IPO.aspx
//   - Exact response shape (HTML postback vs JSON)
//   - Exact field names in the IPO listing / check response
//
// The adapter below attempts a form-post to IPO.aspx with the PAN and reads
// the AntiAuthToken from the page first. If the live site behaves differently,
// the check will surface a clear error instead of returning wrong results.

import axios, { AxiosInstance } from "axios";
import { RegistrarAdapter } from "./adapter.interface";
import { AllotmentResult } from "@/types/allotment.types";
import { IPO } from "@/types/ipo.types";
import { log } from "@/services/logger.service";
import { bulkCheck, withRetry } from "./shared";

const INTEGRATED_REGISTRY_BASE = "https://www.integratedregistry.in/IRMS_V2";
const IPO_PAGE_URL = `${INTEGRATED_REGISTRY_BASE}/IPO.aspx`;
const IPO_LISTING_URL = `${INTEGRATED_REGISTRY_BASE}/IPOListing.aspx`;

// AntiAuthToken is read from a hidden input #AntiAuthToken on the IPO page.
const ANTI_AUTH_TOKEN_RE = /<input[^>]*id="AntiAuthToken"[^>]*value="([^"]*)"/i;

// Extract PAN/name/allotment data from an HTML response — best effort, field
// names vary across IRMS versions.
function extractPanResult(html: string, pan: string): {
  name?: string;
  allottedShares?: number;
  appliedShares?: number;
  status: "allotted" | "not_allotted" | "not_found" | "error";
  error?: string;
} {
  const text = html.replace(/\s+/g, " ");

  // Not-found sentinels
  if (
    /no\s*record|not\s*found|not\s*applied|no\s*data|invalid\s*pan/i.test(text)
  ) {
    return { status: "not_found" };
  }

  // Try to find a table row containing this PAN
  const panIndex = text.indexOf(pan);
  if (panIndex === -1) {
    return { status: "not_found" };
  }

  const windowText = text.slice(Math.max(0, panIndex - 500), panIndex + 500);

  // Look for share counts near the PAN
  const allottedMatch = windowText.match(/allotted[^<]{0,80}?(\d[\d,]*)/i);
  const appliedMatch = windowText.match(/applied[^<]{0,80}?(\d[\d,]*)/i);
  const nameMatch = windowText.match(/name[^<]{0,80}?([A-Za-z][^<]{0,60}?)</i);

  const allottedShares = allottedMatch
    ? Number(allottedMatch[1].replace(/,/g, ""))
    : NaN;
  const appliedShares = appliedMatch
    ? Number(appliedMatch[1].replace(/,/g, ""))
    : NaN;

  if (Number.isNaN(allottedShares)) {
    return { status: "error", error: "Could not parse allotment data from response." };
  }

  return {
    status: allottedShares > 0 ? "allotted" : "not_allotted",
    name: nameMatch ? nameMatch[1].trim() : undefined,
    allottedShares,
    appliedShares: Number.isNaN(appliedShares) ? undefined : appliedShares,
  };
}

export class IntegratedRegistryAdapter implements RegistrarAdapter {
  readonly name = "integratedregistry";
  readonly displayName = "Integrated Registry (IRMS)";

  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  }

  /** Fetch the IPO page once to capture the AntiAuthToken and __VIEWSTATE. */
  private async getPageState(): Promise<{
    antiAuthToken?: string;
    viewState?: string;
  }> {
    const response = await withRetry(() =>
      this.http.get<string>(IPO_PAGE_URL)
    );
    const html = response.data;

    const tokenMatch = html.match(ANTI_AUTH_TOKEN_RE);
    const viewStateMatch = html.match(
      /<input[^>]*name="__VIEWSTATE"[^>]*value="([^"]*)"/i
    );

    return {
      antiAuthToken: tokenMatch?.[1],
      viewState: viewStateMatch?.[1],
    };
  }

  async getActiveIPOs(): Promise<IPO[]> {
    const started = Date.now();
    try {
      const response = await withRetry(() =>
        this.http.get<string>(IPO_LISTING_URL)
      );
      const html = response.data;
      const syncedAt = new Date().toISOString();
      const ipos: IPO[] = [];

      // Best-effort: extract IPO links/names from the listing page HTML.
      // Anchor pattern: <a href="...">IPO Name</a> — field names vary.
      const linkRe = /<a[^>]*href="([^"]*(?:IPO|ipo|Status|status)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match: RegExpExecArray | null;
      while ((match = linkRe.exec(html)) !== null) {
        const href = match[1];
        const name = match[2].replace(/<[^>]*>/g, "").trim();
        // Extract a client id from the href query string if present.
        const qsMatch = href.match(/[?&](?:id|clientid|ipo|company|code)=([^&]+)/i);
        const clientId = qsMatch ? qsMatch[1] : href.replace(/\D/g, "");
        if (name && clientId) {
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

      log("info", "ipo_sync_success", `Fetched ${ipos.length} IPO candidates from Integrated Registry listing`, {
        durationMs: Date.now() - started,
        meta: { count: ipos.length, registrar: this.name },
      });
      return ipos;
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number } };
      log("error", "ipo_sync_failure", `Integrated Registry listing failed: ${err.message ?? "unknown"}`, {
        meta: { registrar: this.name, httpStatus: err.response?.status ?? "none" },
      });
      throw err;
    }
  }

  async checkAllotment(pan: string, clientId: string): Promise<AllotmentResult> {
    const normalizedPan = pan.toUpperCase().trim();
    const started = Date.now();

    try {
      // Step 1: load the page to obtain the AntiAuthToken (and __VIEWSTATE).
      const state = await this.getPageState();

      // Step 2: POST the PAN back to IPO.aspx. The exact form field names are
      // not yet verified; we send the PAN under common names and the token.
      const formData: Record<string, string> = {};
      if (state.antiAuthToken) {
        formData["__AntiAuthToken"] = state.antiAuthToken;
        formData["AntiAuthToken"] = state.antiAuthToken;
      }
      if (state.viewState) {
        formData["__VIEWSTATE"] = state.viewState;
      }
      // Common PAN field names — one of these may match the live form.
      formData["txtPAN"] = normalizedPan;
      formData["txtPan"] = normalizedPan;
      formData["PAN"] = normalizedPan;
      formData["PanNo"] = normalizedPan;
      if (clientId) {
        formData["clientid"] = clientId;
        formData["ClientId"] = clientId;
      }

      const response = await withRetry(() =>
        this.http.post<string>(IPO_PAGE_URL, new URLSearchParams(formData).toString(), {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            // XAntiAuthToken header as observed in AjaxLoaderV2.js
            ...(state.antiAuthToken ? { "XAntiAuthToken": state.antiAuthToken } : {}),
          },
        })
      );

      const result = extractPanResult(response.data, normalizedPan);

      log("info", "api_response_time", "Integrated Registry PAN query completed", {
        durationMs: Date.now() - started,
        meta: { clientId, registrar: this.name, status: result.status },
      });

      return {
        pan: normalizedPan,
        name: result.name,
        appliedShares: result.appliedShares,
        allottedShares: result.allottedShares,
        status: result.status,
        error: result.error,
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number } };

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
