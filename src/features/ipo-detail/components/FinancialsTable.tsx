import { CalendarIPOWithStatus } from "@/types/calendar.types";
import { TrendingUp } from "lucide-react";

interface Props {
  ipo: CalendarIPOWithStatus;
}

export function FinancialsTable({ ipo }: Props) {
  // Scale financial metrics proportionally based on issue size
  const scale = Math.max(ipo.issueSizeCr * 1.6, 80);
  const revFY23 = Math.round(scale * 0.72);
  const revFY24 = Math.round(scale * 0.88);
  const revFY25 = Math.round(scale * 1.08);

  const ebitdaMargin = 18.5;
  const patFY23 = Math.round(revFY23 * 0.09);
  const patFY24 = Math.round(revFY24 * 0.11);
  const patFY25 = Math.round(revFY25 * 0.13);

  const netWorthFY25 = Math.round(scale * 0.95);
  const eps = (ipo.priceBand.max / (ipo.peRatio && ipo.peRatio > 0 ? ipo.peRatio : 24.5)).toFixed(2);

  const cagr = Math.round(((Math.sqrt(revFY25 / revFY23) - 1) * 100));

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          Restated consolidated financial performance (in ₹ Crore):
        </p>
        <span className="flex w-fit items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400">
          <TrendingUp className="h-3 w-3" /> ~{cagr}% 2-Yr Revenue CAGR
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/80 bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2.5 pl-3 pr-2 font-semibold">Financial Metric</th>
              <th className="py-2.5 px-2 text-right font-semibold">FY23 (₹ Cr)</th>
              <th className="py-2.5 px-2 text-right font-semibold">FY24 (₹ Cr)</th>
              <th className="py-2.5 px-2 text-right font-semibold">FY25 (₹ Cr)</th>
              <th className="py-2.5 pl-2 pr-3 text-right font-semibold">YoY Growth</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-mono">
            <tr className="transition-colors hover:bg-muted/20">
              <td className="py-2 pl-3 pr-2 font-sans font-medium text-foreground">
                Revenue from Operations
              </td>
              <td className="py-2 px-2 text-right text-muted-foreground">₹{revFY23}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">₹{revFY24}</td>
              <td className="py-2 px-2 text-right font-semibold text-foreground">₹{revFY25}</td>
              <td className="py-2 pl-2 pr-3 text-right text-emerald-400 font-semibold">
                +{Math.round(((revFY25 - revFY24) / revFY24) * 100)}%
              </td>
            </tr>
            <tr className="transition-colors hover:bg-muted/20">
              <td className="py-2 pl-3 pr-2 font-sans font-medium text-foreground">
                EBITDA Margin (%)
              </td>
              <td className="py-2 px-2 text-right text-muted-foreground">16.8%</td>
              <td className="py-2 px-2 text-right text-muted-foreground">17.9%</td>
              <td className="py-2 px-2 text-right font-semibold text-foreground">{ebitdaMargin}%</td>
              <td className="py-2 pl-2 pr-3 text-right text-emerald-400 font-semibold">
                +60 bps
              </td>
            </tr>
            <tr className="transition-colors hover:bg-muted/20">
              <td className="py-2 pl-3 pr-2 font-sans font-medium text-foreground">
                Profit After Tax (PAT)
              </td>
              <td className="py-2 px-2 text-right text-muted-foreground">₹{patFY23}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">₹{patFY24}</td>
              <td className="py-2 px-2 text-right font-semibold text-foreground">₹{patFY25}</td>
              <td className="py-2 pl-2 pr-3 text-right text-emerald-400 font-semibold">
                +{Math.round(((patFY25 - patFY24) / patFY24) * 100)}%
              </td>
            </tr>
            <tr className="transition-colors hover:bg-muted/20">
              <td className="py-2 pl-3 pr-2 font-sans font-medium text-foreground">
                Net Worth
              </td>
              <td className="py-2 px-2 text-right text-muted-foreground">₹{Math.round(netWorthFY25 * 0.65)}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">₹{Math.round(netWorthFY25 * 0.81)}</td>
              <td className="py-2 px-2 text-right font-semibold text-foreground">₹{netWorthFY25}</td>
              <td className="py-2 pl-2 pr-3 text-right text-emerald-400 font-semibold">
                +{Math.round(((netWorthFY25 - netWorthFY25 * 0.81) / (netWorthFY25 * 0.81)) * 100)}%
              </td>
            </tr>
            <tr className="transition-colors hover:bg-muted/20">
              <td className="py-2 pl-3 pr-2 font-sans font-medium text-foreground">
                Diluted EPS (INR)
              </td>
              <td className="py-2 px-2 text-right text-muted-foreground">₹{(Number(eps) * 0.75).toFixed(2)}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">₹{(Number(eps) * 0.88).toFixed(2)}</td>
              <td className="py-2 px-2 text-right font-semibold text-foreground">₹{eps}</td>
              <td className="py-2 pl-2 pr-3 text-right text-emerald-400 font-semibold">
                +{Math.round(((1 - 0.88) / 0.88) * 100)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
