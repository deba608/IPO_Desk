// src/services/export.service.ts
import * as XLSX from "xlsx";
import { AllotmentResult } from "@/types/allotment.types";

const STATUS_LABELS: Record<string, string> = {
  allotted: "Allotted",
  not_allotted: "Not Allotted",
  not_found: "Not Found",
  error: "Error",
};

export interface ExportRow {
  PAN: string;
  Label: string;
  Name: string;
  "Applied Shares": string;
  "Allotted Shares": string;
  Status: string;
  Remarks?: string;
}

// Cells beginning with these characters are interpreted as formulas by
// Excel/LibreOffice when the CSV is opened — neutralize them (CSV injection).
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function sanitizeCsvValue(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

function sanitizeRowsForCsv(rows: ExportRow[]): ExportRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === "string" ? sanitizeCsvValue(value) : value,
      ])
    ) as ExportRow
  );
}

function buildRows(results: AllotmentResult[]): ExportRow[] {
  return results.map((r) => ({
    PAN: r.pan,
    // Optional client-side nickname (usePanLabels), merged into the payload by
    // the dashboard before export. Absent on direct API exports.
    Label: (r as { label?: string }).label?.trim() || "—",
    Name: r.name ?? "—",
    "Applied Shares": r.appliedShares?.toString() ?? "—",
    "Allotted Shares": r.allottedShares?.toString() ?? "—",
    Status: STATUS_LABELS[r.status] ?? r.status,
    ...(r.error ? { Remarks: r.error } : {}),
  }));
}

export function exportToCSV(
  results: AllotmentResult[],
): Buffer {
  const rows = sanitizeRowsForCsv(buildRows(results));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");

  const csvBuffer = XLSX.write(wb, { bookType: "csv", type: "buffer" });
  // UTF-8 BOM so Excel detects the encoding (₹ renders as mojibake without it).
  return Buffer.concat([Buffer.from("\uFEFF", "utf-8"), Buffer.from(csvBuffer)]);
}

export function exportToXLSX(
  results: AllotmentResult[],
  ipoName: string,
  checkedAt: string
): Buffer {
  const rows = buildRows(results);

  // Main results sheet
  const ws = XLSX.utils.json_to_sheet(rows);

  // Style header row
  const headerRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4F46E5" } },
      alignment: { horizontal: "center" },
    };
  }

  // Auto-size columns
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String(r[key as keyof ExportRow] ?? "").length)) + 2,
  }));
  ws["!cols"] = colWidths;

  // Summary sheet
  const summary = [
    ["IPO Name", ipoName],
    // Runs on the server — pin to IST so a UTC deploy doesn't shift the stamp.
    ["Generated At", `${new Date(checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`],
    ["Total PANs", results.length],
    ["Allotted", results.filter((r) => r.status === "allotted").length],
    ["Not Allotted", results.filter((r) => r.status === "not_allotted").length],
    ["Not Found", results.filter((r) => r.status === "not_found").length],
    ["Errors", results.filter((r) => r.status === "error").length],
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summary);
  summaryWs["!cols"] = [{ wch: 20 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Allotment Results");
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return Buffer.from(xlsxBuffer);
}
