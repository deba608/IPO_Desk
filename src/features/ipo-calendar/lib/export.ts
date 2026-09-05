import ExcelJS from "exceljs";
import { CalendarIPOWithStatus } from "@/types/calendar.types";

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech: "KFintech",
  mufg: "MUFG Intime",
  linkintime: "Link Intime",
  bigshare: "Bigshare",
  skyline: "Skyline",
  purva: "Purva Sharegistry",
  maashitla: "Maashitla",
};

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke async so Safari finishes the download first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportIPOs(ipos: CalendarIPOWithStatus[], format: "xlsx" | "csv") {
  const header = [
    "IPO Name",
    "Symbol",
    "Board",
    "Price Band (Min)",
    "Price Band (Max)",
    "Issue Size (Cr)",
    "Lot Size",
    "Min. Investment (INR)",
    "Open Date",
    "Close Date",
    "Allotment Date",
    "Listing Date",
    "Registrar",
    "GMP (INR)",
    "GMP Premium (%)",
    "Subscription (Total)",
    "Retail Subscription",
    "QIB Subscription",
    "NII Subscription",
    "Lifecycle Status",
  ];
  const rows = ipos.map((ipo) => [
    ipo.name,
    ipo.symbol || "TBA",
    ipo.board === "mainboard" ? "Mainboard" : "SME",
    ipo.priceBand.min,
    ipo.priceBand.max,
    ipo.issueSizeCr,
    ipo.lotSize > 0 ? ipo.lotSize : "TBA",
    ipo.minInvestment > 0 ? ipo.minInvestment : "TBA",
    ipo.openDate,
    ipo.closeDate,
    ipo.allotmentDate || "TBA",
    ipo.listingDate || "TBA",
    REGISTRAR_LABELS[ipo.registrar] || ipo.registrar,
    ipo.gmp !== undefined ? ipo.gmp : "N/A",
    ipo.gmpPercent !== undefined ? `${ipo.gmpPercent}%` : "N/A",
    ipo.subscription?.total !== undefined ? `${ipo.subscription.total}x` : "N/A",
    ipo.subscription?.retail !== undefined ? `${ipo.subscription.retail}x` : "N/A",
    ipo.subscription?.qib !== undefined ? `${ipo.subscription.qib}x` : "N/A",
    ipo.subscription?.nii !== undefined ? `${ipo.subscription.nii}x` : "N/A",
    ipo.lifecycle.toUpperCase(),
  ]);

  const date = new Date().toISOString().split("T")[0];
  const filename = `IPO_Screener_${date}.${format}`;

  if (format === "csv") {
    const esc = (v: unknown): string => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    downloadBlob(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
      filename
    );
    return;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("IPO Screener Data");
  ws.addRow(header);
  ws.addRows(rows);
  ws.getRow(1).font = { bold: true };
  const out = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );
}
