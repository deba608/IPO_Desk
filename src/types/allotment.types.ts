// src/types/allotment.types.ts
export type AllotmentStatus = "allotted" | "not_allotted" | "not_found" | "error";

export interface AllotmentResult {
  pan: string;
  name?: string;
  appliedShares?: number;
  allottedShares?: number;
  status: AllotmentStatus;
  error?: string;
}

export interface CheckRequest {
  pans: string[];
  ipoClientId: string;
}

export interface CheckResponse {
  results: AllotmentResult[];
  summary: {
    total: number;
    allotted: number;
    notAllotted: number;
    notFound: number;
    errors: number;
  };
  ipoName: string;
  ipoClientId: string;
  checkedAt: string;
}

/** One IPO's worth of results within a cross-IPO scan. */
export interface ScanIPOResult {
  ipoId: string;
  ipoName: string;
  registrar: string;
  results: AllotmentResult[];
  summary: {
    total: number;
    allotted: number;
    notAllotted: number;
    notFound: number;
    errors: number;
  };
}

export interface ScanRequest {
  pans: string[];
  /** Optional registrar filter; omit to scan every active IPO. */
  registrar?: string;
}

export interface ScanResponse {
  /** IPOs the PAN(s) actually applied to (allotted or not_allotted), most allotments first. */
  ipos: ScanIPOResult[];
  /** Total active IPOs scanned (including those with no hits). */
  scanned: number;
  /** Distinct PANs checked per IPO. */
  pansChecked: number;
  /** IPOs where at least one PAN was allotted. */
  iposWithAllotment: number;
  totalAllotted: number;
  errors: number;
  checkedAt: string;
}

export interface ExportRequest {
  results: AllotmentResult[];
  format: "csv" | "xlsx";
  ipoName: string;
  checkedAt: string;
}

// Raw KFintech API response
export interface KFinTechAllotmentRecord {
  Name: string;
  Pan_No: string;
  App_Shares: string;
  All_Shares: string;
}

export interface KFinTechResponse {
  data: KFinTechAllotmentRecord[];
}

// Raw Bigshare Data.aspx/FetchIpodetails response (`d` property)
export interface BigShareCheckRecord {
  APPLICATION_NO: string;
  /** DP ID / folio — also carries sentinel messages like "No data found" */
  DPID: string;
  Name: string;
  APPLIED: string;
  ALLOTED: string;
  Status?: string;
  Message?: string;
}

export interface BigShareCheckResponse {
  d: BigShareCheckRecord;
}
