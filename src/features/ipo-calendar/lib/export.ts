import * as XLSX from "xlsx";
import { CalendarIPOWithStatus } from "@/types/calendar.types";

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech: "KFintech",
  mufg: "MUFG Intime",
  linkintime: "Link Intime",
  bigshare: "Bigshare",
};

export function exportIPOs(ipos: CalendarIPOWithStatus[], format: "xlsx" | "csv") {
  const data = ipos.map((ipo) => ({
    "IPO Name": ipo.name,
    "Symbol": ipo.symbol || "TBA",
    "Board": ipo.board === "mainboard" ? "Mainboard" : "SME",
    "Price Band (Min)": ipo.priceBand.min,
    "Price Band (Max)": ipo.priceBand.max,
    "Issue Size (Cr)": ipo.issueSizeCr,
    "Lot Size": ipo.lotSize > 0 ? ipo.lotSize : "TBA",
    "Min. Investment (INR)": ipo.minInvestment > 0 ? ipo.minInvestment : "TBA",
    "Open Date": ipo.openDate,
    "Close Date": ipo.closeDate,
    "Allotment Date": ipo.allotmentDate || "TBA",
    "Listing Date": ipo.listingDate || "TBA",
    "Registrar": REGISTRAR_LABELS[ipo.registrar] || ipo.registrar,
    "GMP (INR)": ipo.gmp !== undefined ? ipo.gmp : "N/A",
    "GMP Premium (%)": ipo.gmpPercent !== undefined ? `${ipo.gmpPercent}%` : "N/A",
    "Subscription (Total)": ipo.subscription?.total !== undefined ? `${ipo.subscription.total}x` : "N/A",
    "Retail Subscription": ipo.subscription?.retail !== undefined ? `${ipo.subscription.retail}x` : "N/A",
    "QIB Subscription": ipo.subscription?.qib !== undefined ? `${ipo.subscription.qib}x` : "N/A",
    "NII Subscription": ipo.subscription?.nii !== undefined ? `${ipo.subscription.nii}x` : "N/A",
    "Lifecycle Status": ipo.lifecycle.toUpperCase(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "IPO Screener Data");

  const date = new Date().toISOString().split("T")[0];
  const filename = `IPO_Screener_${date}.${format}`;

  if (format === "xlsx") {
    XLSX.writeFile(workbook, filename);
  } else {
    // Generate CSV and write
    XLSX.writeFile(workbook, filename, { bookType: "csv" });
  }
}
