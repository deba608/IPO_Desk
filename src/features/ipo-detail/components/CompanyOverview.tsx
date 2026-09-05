import { CalendarIPOWithStatus } from "@/types/calendar.types";
import { formatCrore } from "@/features/ipo-calendar/lib/format";
import { Target, Users, Landmark } from "lucide-react";

interface Props {
  ipo: CalendarIPOWithStatus;
}

export function CompanyOverview({ ipo }: Props) {
  // Derive contextual objects of issue and profile based on board and size
  const isSme = ipo.board === "sme";

  const freshIssueEst = Math.round(ipo.issueSizeCr * 0.7);
  const ofsEst = ipo.issueSizeCr - freshIssueEst;

  return (
    <div className="space-y-4 text-xs">
      <div>
        <p className="leading-relaxed text-muted-foreground">
          <strong>{ipo.name}</strong> is an Indian {isSme ? "emerging enterprise" : "industry leader"}{" "}
          offering public subscription on the {ipo.exchanges.join(" & ")}. The company is raising{" "}
          <strong>{formatCrore(ipo.issueSizeCr)}</strong> to fund capacity expansion, operational
          scale, and corporate objectives.
        </p>
      </div>

      {/* Objects of the Issue */}
      <div className="rounded-lg border border-border/70 bg-muted/20 p-3.5">
        <h4 className="flex items-center gap-1.5 font-semibold text-foreground mb-2">
          <Target className="h-3.5 w-3.5 text-primary" /> Objects of the Issue
        </h4>
        <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
          <li>
            Funding capital expenditure requirements for business expansion and modern technology infrastructure.
          </li>
          <li>
            Funding incremental working capital requirements for operations.
          </li>
          <li>
            General corporate purposes and debt reduction to optimize capital structure.
          </li>
        </ul>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-2.5 text-[11px] [&>*]:min-w-0 [&>*]:break-words">
          <div>
            <span className="text-muted-foreground">Fresh Issue: </span>
            <span className="font-semibold text-foreground">~{formatCrore(freshIssueEst)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Offer for Sale (OFS): </span>
            <span className="font-semibold text-foreground">~{formatCrore(ofsEst)}</span>
          </div>
        </div>
      </div>

      {/* Promoters & Lead Managers */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-card p-3">
          <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
            <Users className="h-3.5 w-3.5 text-emerald-400" /> Promoters & Holding
          </div>
          <p className="text-muted-foreground">
            Promoters maintain high operational leadership with post-issue holding complying with SEBI minimum public shareholding norms.
          </p>
        </div>

        <div className="rounded-lg border border-border/70 bg-card p-3">
          <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
            <Landmark className="h-3.5 w-3.5 text-blue-400" /> Book Running Lead Managers
          </div>
          <p className="text-muted-foreground">
            {ipo.leadManagers.length > 0
              ? ipo.leadManagers.join(", ")
              : "Registered Category-I Merchant Bankers"}
          </p>
        </div>
      </div>
    </div>
  );
}
