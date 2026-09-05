"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search,
  ExternalLink,
  Building2,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CalendarIPOWithStatus } from "@/types/calendar.types";

export function IpoManager() {
  const [ipos, setIpos] = useState<CalendarIPOWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [boardFilter, setBoardFilter] = useState<"all" | "mainboard" | "sme">("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  // Serializes overlapping loads so a double-clicked Refresh can't race.
  const loadingRef = useRef(false);

  const loadCatalogue = useCallback(async (signal?: AbortSignal) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar", { signal });
      if (!res.ok) {
        throw new Error(`Server responded ${res.status}`);
      }
      const data = await res.json();
      setIpos(data.ipos || []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load catalogue");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount reuses the manual-refresh loader
    void loadCatalogue(controller.signal);
    return () => controller.abort();
  }, [loadCatalogue]);

  const filteredIpos = useMemo(
    () =>
      ipos.filter((ipo) => {
        if (boardFilter !== "all" && ipo.board !== boardFilter) return false;
        if (lifecycleFilter !== "all" && ipo.lifecycle !== lifecycleFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            (ipo.name ?? "").toLowerCase().includes(q) ||
            (ipo.registrar ?? "").toLowerCase().includes(q) ||
            (ipo.leadManagers ?? []).some((lm) =>
              (lm ?? "").toLowerCase().includes(q)
            )
          );
        }
        return true;
      }),
    [ipos, boardFilter, lifecycleFilter, searchQuery]
  );

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            IPO Master Registry ({filteredIpos.length} issues)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Board Filter */}
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
            {(["all", "mainboard", "sme"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBoardFilter(b)}
                className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                  boardFilter === b
                    ? "bg-card font-semibold text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {b === "all" ? "All Boards" : b}
              </button>
            ))}
          </div>

          {/* Lifecycle Filter */}
          <select
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">All Lifecycles</option>
            <option value="open">Open</option>
            <option value="upcoming">Upcoming</option>
            <option value="closed">Closed</option>
            <option value="listed">Listed</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search IPO or registrar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <button
            onClick={() => loadCatalogue()}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400">
          Catalogue error: {error}
        </div>
      )}

      {/* ── IPO Table ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 pl-4 pr-3 font-semibold">IPO Name</th>
                <th className="py-3 px-3 font-semibold">Board / Status</th>
                <th className="py-3 px-3 font-semibold">Dates (Open – Close)</th>
                <th className="py-3 px-3 font-semibold text-right">Price Band</th>
                <th className="py-3 px-3 font-semibold text-right">Issue Size</th>
                <th className="py-3 px-3 font-semibold text-right">GMP / Listing</th>
                <th className="py-3 px-3 font-semibold">Registrar</th>
                <th className="py-3 pl-3 pr-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredIpos.length > 0 ? (
                filteredIpos.map((ipo) => (
                  <tr
                    key={ipo.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="py-3 pl-4 pr-3">
                      <div className="font-medium text-foreground">
                        {ipo.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {ipo.id}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            ipo.board === "mainboard" ? "default" : "outline"
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {ipo.board === "mainboard" ? "Main" : "SME"}
                        </Badge>
                        <Badge
                          variant={
                            ipo.lifecycle === "open"
                              ? "success"
                              : ipo.lifecycle === "listed"
                              ? "secondary"
                              : "info"
                          }
                          className="text-[10px] px-1.5 py-0 capitalize"
                        >
                          {ipo.lifecycle}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      <div>{ipo.openDate} → {ipo.closeDate}</div>
                      {ipo.listingDate && (
                        <div className="text-[10px] text-muted-foreground">
                          Listing: {ipo.listingDate}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-medium">
                      ₹{ipo.priceBand.min}–{ipo.priceBand.max}
                    </td>
                    <td className="py-3 px-3 text-right font-medium">
                      ₹{ipo.issueSizeCr.toLocaleString("en-IN")} Cr
                    </td>
                    <td className="py-3 px-3 text-right">
                      {ipo.gmp !== undefined ? (
                        <span className="font-semibold text-emerald-400">
                          ₹{ipo.gmp}{" "}
                          {ipo.gmpPercent !== undefined && `(${ipo.gmpPercent}%)`}
                        </span>
                      ) : ipo.listingGainPercent !== undefined ? (
                        <span
                          className={`font-semibold ${
                            ipo.listingGainPercent >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {ipo.listingGainPercent >= 0 ? "+" : ""}
                          {ipo.listingGainPercent}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] capitalize">
                      {ipo.registrar}
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/ipo/${ipo.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          Details <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                        <Link
                          href={`/?ipo=${encodeURIComponent(ipo.name)}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          Check <ClipboardCheck className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    {loading ? "Loading active IPO catalogue..." : "No IPOs found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
