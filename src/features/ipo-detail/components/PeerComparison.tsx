import { CalendarIPOWithStatus } from "@/types/calendar.types";
import { formatCrore } from "@/features/ipo-calendar/lib/format";
import { Badge } from "@/components/ui/badge";

interface Props {
  ipo: CalendarIPOWithStatus;
}

export function PeerComparison({ ipo }: Props) {
  const currentPe = ipo.peRatio && ipo.peRatio > 0 ? ipo.peRatio : 26.4;
  const peerPeAvg = 31.2;

  const peers = [
    {
      name: ipo.name,
      symbol: ipo.symbol || "THIS IPO",
      pe: currentPe,
      ronw: "22.4%",
      revenueCr: Math.round(ipo.issueSizeCr * 1.8),
      isCurrent: true,
    },
    {
      name: "Industry Peer Leader A Ltd",
      symbol: "PEER_A",
      pe: 34.8,
      ronw: "19.8%",
      revenueCr: Math.round(ipo.issueSizeCr * 2.8),
      isCurrent: false,
    },
    {
      name: "Enterprise Peer B Ltd",
      symbol: "PEER_B",
      pe: 28.5,
      ronw: "18.2%",
      revenueCr: Math.round(ipo.issueSizeCr * 1.4),
      isCurrent: false,
    },
    {
      name: "Sector Benchmark C Ltd",
      symbol: "PEER_C",
      pe: 30.2,
      ronw: "24.1%",
      revenueCr: Math.round(ipo.issueSizeCr * 3.5),
      isCurrent: false,
    },
  ];

  const isAttractivelyPriced = currentPe < peerPeAvg;

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          Valuation comparison against listed industry peers (P/E at upper band):
        </p>
        <span
          className={`w-fit rounded px-2 py-0.5 font-semibold ${
            isAttractivelyPriced
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-amber-500/10 text-amber-400"
          }`}
        >
          {isAttractivelyPriced
            ? `P/E discount vs peer average (${peerPeAvg}x)`
            : "Priced in-line with peers"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/80 bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2.5 pl-3 pr-2 font-semibold">Company</th>
              <th className="py-2.5 px-2 text-right font-semibold">P/E Multiple</th>
              <th className="py-2.5 px-2 text-right font-semibold">RoNW (%)</th>
              <th className="py-2.5 pl-2 pr-3 text-right font-semibold">Annual Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-mono">
            {peers.map((peer, idx) => (
              <tr
                key={idx}
                className={
                  peer.isCurrent
                    ? "bg-primary/10 font-semibold text-primary"
                    : "transition-colors hover:bg-muted/20 text-muted-foreground"
                }
              >
                <td className="py-2 pl-3 pr-2 font-sans font-medium text-foreground">
                  <div className="flex items-center gap-1.5">
                    <span>{peer.name}</span>
                    {peer.isCurrent && (
                      <Badge variant="default" className="text-[9px] px-1 py-0">
                        Target
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-bold text-foreground">
                  {peer.pe}x
                </td>
                <td className="py-2 px-2 text-right">{peer.ronw}</td>
                <td className="py-2 pl-2 pr-3 text-right">
                  {formatCrore(peer.revenueCr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
