// src/services/export.service.ts
import ExcelJS from "exceljs";
import { AllotmentResult } from "@/types/allotment.types";

const STATUS_LABELS: Record<string, string> = {
  allotted: "Allotted",
  not_allotted: "Not Allotted",
  not_found: "Not Applied",
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

function toCsvCell(value: unknown): string {
  const raw = typeof value === "string" ? sanitizeCsvValue(value) : String(value ?? "");
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
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

const CSV_HEADERS = [
  "PAN",
  "Label",
  "Name",
  "Applied Shares",
  "Allotted Shares",
  "Status",
  "Remarks",
] as const;

export function exportToCSV(results: AllotmentResult[]): Buffer {
  const rows = buildRows(results);
  const lines = [
    CSV_HEADERS.map(toCsvCell).join(","),
    ...rows.map((row) =>
      CSV_HEADERS.map((h) => toCsvCell(row[h] ?? "")).join(",")
    ),
  ];
  // UTF-8 BOM so Excel detects the encoding (₹ renders as mojibake without it).
  return Buffer.concat([
    Buffer.from("\uFEFF", "utf-8"),
    Buffer.from(lines.join("\r\n"), "utf-8"),
  ]);
}

function styleHeaderRow(ws: ExcelJS.Worksheet): void {
  const header = ws.getRow(1);
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    };
    cell.alignment = { horizontal: "center" };
  });
}

export async function exportToXLSX(
  results: AllotmentResult[],
  ipoName: string,
  checkedAt: string
): Promise<Buffer> {
  const rows = buildRows(results);
  const wb = new ExcelJS.Workbook();

  // Main results sheet
  const ws = wb.addWorksheet("Allotment Results");
  ws.columns = CSV_HEADERS.map((h) => ({ header: h, key: h, width: 18 }));
  ws.addRows(rows);
  styleHeaderRow(ws);
  // Auto-size columns to content
  ws.columns.forEach((col) => {
    let width = String(col.header ?? "").length;
    col.eachCell?.((cell, rowNumber) => {
      if (rowNumber === 1) return;
      width = Math.max(width, String(cell.value ?? "").length);
    });
    col.width = Math.min(width + 2, 60);
  });

  // Summary sheet
  const summaryWs = wb.addWorksheet("Summary");
  summaryWs.columns = [
    { header: "Metric", key: "metric", width: 20 },
    { header: "Value", key: "value", width: 40 },
  ];
  summaryWs.addRows([
    { metric: "IPO Name", value: ipoName },
    // Runs on the server — pin to IST so a UTC deploy doesn't shift the stamp.
    {
      metric: "Generated At",
      value: `${new Date(checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
    },
    { metric: "Total PANs", value: results.length },
    {
      metric: "Allotted",
      value: results.filter((r) => r.status === "allotted").length,
    },
    {
      metric: "Not Allotted",
      value: results.filter((r) => r.status === "not_allotted").length,
    },
    {
      metric: "Not Applied",
      value: results.filter((r) => r.status === "not_found").length,
    },
    {
      metric: "Errors",
      value: results.filter((r) => r.status === "error").length,
    },
  ]);
  styleHeaderRow(summaryWs);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
