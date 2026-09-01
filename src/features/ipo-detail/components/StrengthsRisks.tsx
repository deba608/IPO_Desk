import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { CalendarIPOWithStatus } from "@/types/calendar.types";

interface Props {
  ipo: CalendarIPOWithStatus;
}

export function StrengthsRisks({ ipo }: Props) {
  const isSme = ipo.board === "sme";

  const strengths = [
    "Established market presence with diversified multi-channel customer relationships.",
    "Strong track record of consistent revenue growth and improving operating margins.",
    "Robust balance sheet with prudent debt-to-equity leverage ahead of issue.",
    "Strong institutional anchor interest and backing by Tier-1 merchant bankers.",
  ];

  const risks = [
    isSme
      ? "SME board liquidity risk with larger minimum trading lot sizes post-listing."
      : "Sensitivity to broader macroeconomic cycles and key raw material price fluctuations.",
    "Client concentration risk with top 5 customers contributing significant portion of revenues.",
    "Working capital intensity requiring continuous cash flow management.",
    "Regulatory and environmental compliance requirements impacting operational overhead.",
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 text-xs">
      {/* Strengths Card */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
          <ShieldCheck className="h-4 w-4" /> Key Investment Strengths
        </div>
        <ul className="space-y-2 text-muted-foreground">
          {strengths.map((st, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
              <span>{st}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Risks Card */}
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-rose-400">
          <AlertTriangle className="h-4 w-4" /> Key Risk Factors
        </div>
        <ul className="space-y-2 text-muted-foreground">
          {risks.map((rk, i) => (
            <li key={i} className="flex items-start gap-2">
              <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
              <span>{rk}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
