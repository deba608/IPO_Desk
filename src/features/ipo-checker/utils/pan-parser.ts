// src/features/ipo-checker/utils/pan-parser.ts
import * as XLSX from "xlsx";
import { PAN_REGEX } from "./pan-validator";

export interface ParsedFile {
  pans: string[];
  totalRows: number;
  detectedColumn?: string;
  invalidCount: number;
  duplicateCount: number;
}

/**
 * Detect which column in a worksheet is most likely to contain PAN numbers
 */
function detectPANColumn(
  worksheet: XLSX.WorkSheet,
  headers: string[]
): string | undefined {
  // First: check for headers naming PAN explicitly. Word boundary is required —
  // a plain /pan/i also matches "Company", "Expansion", "Japan".
  const panHeader = headers.find((h) => /\bpan(\s*(no\.?|number|card))?\b/i.test(h));
  if (panHeader) return panHeader;

  // Second: score each column by % of values matching PAN regex
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
  let bestColumn: string | undefined;
  let bestScore = 0;

  for (const header of headers) {
    const colIdx = headers.indexOf(header);
    let panMatches = 0;
    let total = 0;

    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIdx });
      const cell = worksheet[cellAddress];
      if (!cell) continue;

      const value = String(cell.v ?? "").toUpperCase().trim();
      if (value.length > 0) {
        total++;
        if (PAN_REGEX.test(value)) panMatches++;
      }
    }

    if (total > 0) {
      const score = panMatches / total;
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestColumn = header;
      }
    }
  }

  return bestColumn;
}

export async function parseExcelFile(file: File): Promise<ParsedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    worksheet,
    { defval: "" }
  );

  if (jsonData.length === 0) {
    return { pans: [], totalRows: 0, invalidCount: 0, duplicateCount: 0 };
  }

  const headers = Object.keys(jsonData[0]);
  const detectedColumn = detectPANColumn(
    worksheet,
    headers
  );

  if (!detectedColumn) {
    // Try all columns
    const allValues = jsonData.flatMap((row) =>
      Object.values(row).map((v) => String(v ?? "").toUpperCase().trim())
    );
    const pans = [...new Set(allValues.filter((v) => PAN_REGEX.test(v)))];
    return {
      pans,
      totalRows: jsonData.length,
      invalidCount: 0,
      duplicateCount: allValues.filter((v) => PAN_REGEX.test(v)).length - pans.length,
    };
  }

  const seen = new Set<string>();
  let invalidCount = 0;
  let duplicateCount = 0;
  const pans: string[] = [];

  for (const row of jsonData) {
    const value = String(row[detectedColumn] ?? "").toUpperCase().trim();
    if (!value) continue;

    if (!PAN_REGEX.test(value)) {
      invalidCount++;
      continue;
    }

    if (seen.has(value)) {
      duplicateCount++;
      continue;
    }

    seen.add(value);
    pans.push(value);
  }

  return {
    pans,
    totalRows: jsonData.length,
    detectedColumn,
    invalidCount,
    duplicateCount,
  };
}
