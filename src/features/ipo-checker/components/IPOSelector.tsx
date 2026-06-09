"use client";

import { useState, useEffect } from "react";
import { Search, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { IPO } from "@/types/ipo.types";
import { cn } from "@/lib/utils";

interface IPOSelectorProps {
  value: IPO | null;
  onChange: (ipo: IPO | null) => void;
}

export function IPOSelector({ value, onChange }: IPOSelectorProps) {
  const [ipos, setIpos] = useState<IPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function fetchIPOs() {
      try {
        setLoading(true);
        const response = await fetch("/api/ipos");
        if (!response.ok) throw new Error("Failed to fetch IPOs");
        const data = await response.json();
        setIpos(data.ipos ?? []);
      } catch {
        setError("Failed to load IPO list. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    fetchIPOs();
  }, []);

  const filtered = ipos.filter((ipo) =>
    ipo.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Select IPO <span className="text-destructive">*</span>
      </label>

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-input bg-background px-4 py-3 text-sm transition-all",
            "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring",
            open && "border-primary ring-2 ring-ring",
            !value && "text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />
                <span>Loading IPOs...</span>
              </>
            ) : error ? (
              <>
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                <span className="text-destructive">{error}</span>
              </>
            ) : value ? (
              <span className="truncate font-medium text-foreground">
                {value.name}
              </span>
            ) : (
              <span>Select an active IPO...</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!loading && !error && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {ipos.length} active
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
        </button>

        {/* Dropdown */}
        {open && !loading && !error && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />

            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-border bg-popover shadow-xl">
              {/* Search */}
              <div className="p-2 border-b border-border">
                <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    placeholder="Search IPOs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    autoFocus
                  />
                </div>
              </div>

              {/* IPO List */}
              <div className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No IPOs match your search
                  </div>
                ) : (
                  filtered.map((ipo) => (
                    <button
                      key={ipo.clientId}
                      type="button"
                      onClick={() => {
                        onChange(ipo);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        value?.clientId === ipo.clientId &&
                          "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      <span className="truncate pr-4">{ipo.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground font-mono">
                        {ipo.clientId}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border px-4 py-2">
                <p className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {ipos.length} active IPOs
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {value && (
        <p className="text-xs text-muted-foreground">
          Client ID:{" "}
          <code className="font-mono text-primary">{value.clientId}</code>
          {" · "}
          Registrar: <span className="capitalize">{value.registrar}</span>
        </p>
      )}
    </div>
  );
}
