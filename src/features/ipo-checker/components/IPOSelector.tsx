"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  ChevronDown,
  Loader2,
  AlertCircle,
  Check,
  X,
  Building2,
  Inbox,
} from "lucide-react";
import { IPO } from "@/types/ipo.types";
import { cn } from "@/lib/utils";

function isSME(name: string): boolean {
  return /\bSME\b/i.test(name);
}

/** Normalise an IPO name for fuzzy matching: drop suffixes + non-alphanumerics. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|ipo|pvt|private)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Best match for a target name within a list, or null. */
function matchByName(ipos: IPO[], target: string): IPO | null {
  const t = normalizeName(target);
  if (!t) return null;
  return (
    ipos.find((i) => normalizeName(i.name) === t) ??
    ipos.find((i) => {
      const n = normalizeName(i.name);
      return n.startsWith(t) || t.startsWith(n);
    }) ??
    null
  );
}

/** Split a name into [before, match, after] for highlighting the search hit. */
function highlight(name: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return name;
  const idx = name.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="rounded bg-primary/25 text-primary-foreground">
        {name.slice(idx, idx + q.length)}
      </mark>
      {name.slice(idx + q.length)}
    </>
  );
}

interface IPOSelectorProps {
  value: IPO | null;
  onChange: (ipo: IPO | null) => void;
}

const REGISTRAR_LABELS: Record<string, string> = {
  kfintech: "KFintech",
  mufg: "MUFG Intime",
  linkintime: "Link Intime",
  bigshare: "Bigshare",
};

const LIST_REFRESH_MS = 60 * 1000;

export function IPOSelector({ value, onChange }: IPOSelectorProps) {
  const [ipos, setIpos] = useState<IPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [registrarFilter, setRegistrarFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const didAutoSelect = useRef(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchIPOs(initial: boolean) {
      try {
        if (initial) setLoading(true);
        const response = await fetch("/api/ipos");
        if (!response.ok) throw new Error("Failed to fetch IPOs");
        const data = await response.json();
        if (!cancelled) {
          const list: IPO[] = data.ipos ?? [];
          setIpos(list);
          setError(null);

          // One-time deep-link preselect: /?ipo=<name> from a calendar page.
          if (!didAutoSelect.current && !value) {
            didAutoSelect.current = true;
            const target = new URLSearchParams(window.location.search).get("ipo");
            if (target) {
              const match = matchByName(list, target);
              if (match) onChange(match);
            }
          }
        }
      } catch {
        // Keep the last good list on background refresh failures
        if (!cancelled && initial) setError("Failed to load IPO list. Please refresh.");
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    }

    fetchIPOs(true);
    const interval = setInterval(() => fetchIPOs(false), LIST_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // Mount-only: polling + one-shot deep-link preselect. value/onChange are
    // read for the initial preselect only and intentionally not re-subscribed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registrars = useMemo(
    () => [...new Set(ipos.map((ipo) => ipo.registrar))],
    [ipos]
  );

  const filtered = useMemo(
    () =>
      ipos.filter(
        (ipo) =>
          (registrarFilter === "all" || ipo.registrar === registrarFilter) &&
          (typeFilter === "all" ||
            (typeFilter === "mainboard" && !isSME(ipo.name)) ||
            (typeFilter === "sme" && isSME(ipo.name))) &&
          ipo.name.toLowerCase().includes(search.toLowerCase())
      ),
    [ipos, registrarFilter, typeFilter, search]
  );

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearch("");
    setRegistrarFilter("all");
    setTypeFilter("all");
  }, []);

  const selectIPO = useCallback(
    (ipo: IPO) => {
      onChange(ipo);
      closeDropdown();
    },
    [onChange, closeDropdown]
  );

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, closeDropdown]);

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const ipo = filtered[activeIndex];
      if (ipo) selectIPO(ipo);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    }
  };

  return (
    <div className="space-y-2" ref={rootRef}>
      <label
        htmlFor="ipo-selector-trigger"
        className="text-sm font-medium"
      >
        Select IPO <span className="text-destructive">*</span>
      </label>

      <div className="relative">
        {/* Trigger Button / Search Input */}
        {open && !loading && !error ? (
          <div
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm transition-all",
              "border-primary ring-2 ring-ring"
            )}
          >
            <div className="flex min-w-0 items-center gap-3 flex-grow">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                id="ipo-selector-trigger"
                type="text"
                placeholder={value ? value.name : "Search by company name..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                className="w-full bg-transparent border-0 outline-none text-foreground text-sm p-0 placeholder:text-muted-foreground focus:ring-0"
                autoFocus
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls="ipo-selector-list"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={closeDropdown}
                aria-label="Close selector"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            id="ipo-selector-trigger"
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls="ipo-selector-list"
            disabled={loading || !!error}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-4 py-3 text-sm transition-all",
              "hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "border-input",
              !value && "text-muted-foreground"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  <span>Loading IPOs...</span>
                </>
              ) : error ? (
                <>
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <span className="text-destructive">{error}</span>
                </>
              ) : value ? (
                <>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="truncate font-medium text-foreground">
                    {value.name}
                  </span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>Select an active IPO...</span>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {value && !loading && !error && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear selection"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(null);
                    }
                  }}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </span>
              )}
              {!loading && !error && !value && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {ipos.length} active
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </div>
          </button>
        )}

        {/* Dropdown */}
        {open && !loading && !error && (
          <div
            id="ipo-selector-list"
            role="listbox"
            className={cn(
              "absolute left-0 right-0 top-full z-20 mt-2 origin-top overflow-hidden rounded-xl border border-border bg-popover shadow-2xl",
              "animate-in fade-in-0 zoom-in-95 duration-150"
            )}
          >
            {/* Filter bar */}
            <div className="border-b border-border p-2 flex flex-wrap items-center gap-1.5">
              {/* Registrar filter */}
              <div className="flex flex-wrap gap-1.5">
                {["all", ...registrars].map((registrar) => {
                  const count =
                    registrar === "all"
                      ? ipos.length
                      : ipos.filter((i) => i.registrar === registrar).length;
                  const active = registrarFilter === registrar;
                  return (
                    <button
                      key={registrar}
                      type="button"
                      onClick={() => setRegistrarFilter(registrar)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {registrar === "all"
                        ? `All ${count}`
                        : `${REGISTRAR_LABELS[registrar] ?? registrar} ${count}`}
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <span className="mx-1 h-4 w-px bg-border shrink-0" />

              {/* Type filter */}
              <div className="flex rounded-md border border-border bg-muted/20 p-0.5">
                {(["all", "mainboard", "sme"] as const).map((type) => {
                  const count = type === "all"
                    ? ipos.length
                    : ipos.filter((i) => type === "mainboard" ? !isSME(i.name) : isSME(i.name)).length;
                  const active = typeFilter === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTypeFilter(type)}
                      className={cn(
                        "rounded px-2 py-1 text-[11px] font-medium transition-all",
                        active
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {type === "all" ? "All" : type === "mainboard" ? "Mainboard" : "SME"}
                      <span className={cn(
                        "ml-1 rounded-full px-1 py-px text-[9px] font-bold",
                        active ? "bg-primary/10 text-primary" : "text-muted-foreground/50"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* IPO List */}
            <div
              ref={listRef}
              className="scrollbar max-h-64 overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Inbox className="h-6 w-6 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">
                    No IPOs match{" "}
                    {search ? (
                      <span className="font-medium text-foreground">
                        “{search}”
                      </span>
                    ) : (
                      "this filter"
                    )}
                  </p>
                </div>
              ) : (
                filtered.map((ipo, i) => {
                  const selected = value?.id === ipo.id;
                  const isActive = i === activeIndex;
                  return (
                    <button
                      key={ipo.id}
                      ref={(el) => {
                        optionRefs.current[i] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => selectIPO(ipo)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                        isActive && "bg-accent text-accent-foreground",
                        selected && "text-primary"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0 transition-opacity",
                            selected
                              ? "text-primary opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="truncate">
                          {highlight(ipo.name, search)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {REGISTRAR_LABELS[ipo.registrar] ?? ipo.registrar}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {filtered.length} of {ipos.length} active
              </p>
              <p className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
                <kbd className="rounded bg-muted px-1 py-0.5 font-mono">↑↓</kbd>
                navigate
                <kbd className="ml-1 rounded bg-muted px-1 py-0.5 font-mono">
                  ↵
                </kbd>
                select
              </p>
            </div>
          </div>
        )}
      </div>

      {value && (
        <p className="text-xs text-muted-foreground">
          Client ID:{" "}
          <code className="font-mono text-primary">{value.clientId}</code>
          {" · "}
          Registrar:{" "}
          <span>{REGISTRAR_LABELS[value.registrar] ?? value.registrar}</span>
        </p>
      )}
    </div>
  );
}
