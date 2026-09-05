// src/features/ipo-checker/utils/pan-parser.ts
// Excel/CSV upload parsing via exceljs (SheetJS-xlsx removed: unmaintained
// with known CVEs). Supports .xlsx and .csv; legacy .xls (BIFF) is not
// readable by exceljs and is rejected with a clear message upstream.
import ExcelJS from "exceljs";
import { PAN_REGEX } from "./pan-validator";

export interface ParsedFile {
  pans: string[];
  totalRows: number;
  detectedColumn?: string;
  invalidCount: number;
  duplicateCount: number;
}

/** Minimal RFC-4180-ish CSV parse (quoted fields, commas, CRLF) into a grid. */
function parseCsvGrid(text: string): string[][] {
  const grid: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip BOM so the first header isn't polluted.
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      grid.push(row);
      row = [];
    } else if (ch === "\r") {
      // Skip; \n handles the break (lone \r also breaks below).
      if (src[i + 1] !== "\n") {
        row.push(field);
        field = "";
        grid.push(row);
        row = [];
      }
    } else {
      field += ch;
    }
  }
  row.push(field);
  grid.push(row);
  // Drop fully-empty rows (trailing newline etc.).
  return grid.filter((r) => r.some((c) => c.trim() !== ""));
}

async function gridFromWorkbook(file: File): Promise<string[][]> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const grid: string[][] = [];
  ws.eachRow((row) => {
    const vals = Array.isArray(row.values) ? row.values : [];
    const cells: string[] = [];
    // exceljs row.values is 1-indexed (index 0 unused).
    for (let i = 1; i < vals.length; i++) {
      const v = vals[i] as unknown;
      if (v === null || v === undefined) {
        cells.push("");
      } else if (
        typeof v === "object" &&
        "text" in (v as Record<string, unknown>)
      ) {
        // Rich-text cell value
        cells.push(String((v as { text: unknown }).text ?? ""));
      } else {
        cells.push(String(v));
      }
    }
    grid.push(cells);
  });
  return grid.filter((r) => r.some((c) => c.trim() !== ""));
}

async function gridFromFile(file: File): Promise<string[][]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return parseCsvGrid(await file.text());
  }
  if (ext === "xlsx") {
    return gridFromWorkbook(file);
  }
  throw new Error(
    "Unsupported file type. Please upload an .xlsx or .csv file (legacy .xls is not supported)."
  );
}

/**
 * Detect which column in a grid is most likely to contain PAN numbers
 */
function detectPANColumn(grid: string[][]): number {
  const headers = grid[0] ?? [];
  // First: check for headers naming PAN explicitly. Word boundary is required —
  // a plain /pan/i also matches "Company", "Expansion", "Japan".
  const named = headers.findIndex((h) =>
    /\bpan(\s*(no\.?|number|card))?\b/i.test(h)
  );
  if (named >= 0) return named;

  // Second: score each column by % of values matching PAN regex
  let bestColumn = -1;
  let bestScore = 0;
  for (let col = 0; col < headers.length; col++) {
    let panMatches = 0;
    let total = 0;
    for (let r = 1; r < grid.length; r++) {
      const value = (grid[r][col] ?? "").toUpperCase().trim();
      if (value.length > 0) {
        total++;
        if (PAN_REGEX.test(value)) panMatches++;
      }
    }
    if (total > 0) {
      const score = panMatches / total;
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestColumn = col;
      }
    }
  }
  return bestColumn;
}

export async function parseExcelFile(file: File): Promise<ParsedFile> {
  const grid = await gridFromFile(file);
  if (grid.length === 0) {
    return { pans: [], totalRows: 0, invalidCount: 0, duplicateCount: 0 };
  }

  const headers = grid[0];
  const detectedIdx = detectPANColumn(grid);

  if (detectedIdx < 0) {
    // Try all columns
    const allValues = grid
      .slice(1)
      .flatMap((row) =>
        row.map((v) => String(v ?? "").toUpperCase().trim())
      );
    const matches = allValues.filter((v) => PAN_REGEX.test(v));
    const pans = [...new Set(matches)];
    return {
      pans,
      totalRows: grid.length - 1,
      invalidCount: 0,
      duplicateCount: matches.length - pans.length,
    };
  }

  const seen = new Set<string>();
  let invalidCount = 0;
  let duplicateCount = 0;
  const pans: string[] = [];

  for (let r = 1; r < grid.length; r++) {
    const value = String(grid[r][detectedIdx] ?? "").toUpperCase().trim();
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
    totalRows: grid.length - 1,
    detectedColumn: headers[detectedIdx],
    invalidCount,
    duplicateCount,
  };
}
