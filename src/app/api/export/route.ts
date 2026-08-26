// src/app/api/export/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { exportToCSV, exportToXLSX } from "@/services/export.service";

const ExportRequestSchema = z.object({
  // Cap the payload — an unbounded array is parsed and materialized into a
  // workbook per request (500 matches /api/check's PAN cap).
  results: z
    .array(
      z.object({
        pan: z.string().max(20),
        name: z.string().max(200).optional(),
        appliedShares: z.number().optional(),
        allottedShares: z.number().optional(),
        status: z.enum(["allotted", "not_allotted", "not_found", "error"]),
        error: z.string().max(500).optional(),
        label: z.string().max(100).optional(),
      })
    )
    .max(500),
  format: z.enum(["csv", "xlsx"]),
  ipoName: z.string().max(200),
  checkedAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = ExportRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { results, format, ipoName, checkedAt } = validated.data;
    const safeIpoName = sanitizeFilename(ipoName);
    const date = new Date(checkedAt).toISOString().split("T")[0];
    const filename = `${safeIpoName}-allotment-${date}.${format}`;

    let buffer: Buffer;
    let contentType: string;

    if (format === "csv") {
      buffer = exportToCSV(results);
      contentType = "text/csv; charset=utf-8";
    } else {
      buffer = exportToXLSX(results, ipoName, checkedAt);
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error("[/api/export] Error:", error);
    return NextResponse.json(
      { error: "Export failed. Please try again." },
      { status: 500 }
    );
  }
}
