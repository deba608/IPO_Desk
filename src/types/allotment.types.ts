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
