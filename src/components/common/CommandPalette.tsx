"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  Search,
  Calendar,
  History,
  Star,
  Sparkles,
  SearchCode,
  Tag,
  Flame,
} from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { CalendarIPOWithStatus } from "@/types/calendar.types";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [ipos, setIpos] = useState<CalendarIPOWithStatus[]>([]);
  const router = useRouter();
  const { ids: watchedIds, toggle: toggleWatch, isWatched } = useWatchlist();
  const [, startTransition] = useTransition();

  // Toggle palette open/closed with Cmd+K or Ctrl+K, or via the header's
  // "open-command-palette" event (search button on desktop + mobile).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const openEvent = () => setOpen(true);
    document.addEventListener("keydown", down);
    window.addEventListener("open-command-palette", openEvent);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("open-command-palette", openEvent);
    };
  }, []);

  // Fetch IPO calendar on mount/open to keep search items fresh
  useEffect(() => {
    if (!open) return;
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ipos) {
          setIpos(data.ipos);
        }
      })
      .catch((err) => console.error("Failed to load command palette search index", err));
  }, [open]);

  const navigate = (path: string) => {
    startTransition(() => {
      router.push(path);
      setOpen(false);
      setQuery("");
    });
  };

  const activeIPOs = ipos.filter(
    (ipo) => ipo.lifecycle === "open" || ipo.lifecycle === "upcoming"
  );
  const otherIPOs = ipos.filter(
    (ipo) => ipo.lifecycle === "closed" || ipo.lifecycle === "listed"
  );
  const watchedIPOs = ipos.filter((ipo) => watchedIds.includes(ipo.id));

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[6px]" />
        <Dialog.Content className="fixed top-[15%] left-[50%] z-50 w-[92vw] max-w-lg -translate-x-[50%] rounded-xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden focus:outline-none">
          <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search IPOs, navigate to sections, and manage your watchlist.
          </Dialog.Description>
          <Command
            label="Global Command Palette"
            className="flex flex-col"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          >
            <div className="flex items-center border-b border-slate-800 px-4">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search IPOs, sections, actions..."
                className="w-full bg-transparent py-4 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>

            <Command.List className="max-h-[340px] overflow-y-auto px-2 py-3 scrollbar">
              <Command.Empty className="py-6 text-center text-sm text-slate-400">
                No matching IPOs or pages found.
              </Command.Empty>

              {/* Pages & Actions */}
              <Command.Group
                heading="Navigation"
                className="text-xs font-semibold text-slate-500 px-3 py-1.5 select-none"
              >
                <Command.Item
                  onSelect={() => navigate("/")}
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-100 transition-colors outline-none"
                >
                  <SearchCode className="h-4 w-4 text-primary" />
                  <span>Allotment Checker</span>
                  <span className="ml-auto text-[10px] text-slate-500">Go to</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/calendar")}
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-100 transition-colors outline-none"
                >
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  <span>IPO Calendar</span>
                  <span className="ml-auto text-[10px] text-slate-500">Go to</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/history")}
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-100 transition-colors outline-none"
                >
                  <History className="h-4 w-4 text-amber-400" />
                  <span>Checking History</span>
                  <span className="ml-auto text-[10px] text-slate-500">Go to</span>
                </Command.Item>
              </Command.Group>

              {/* Watchlist */}
              {watchedIPOs.length > 0 && (
                <Command.Group
                  heading="Watchlisted IPOs"
                  className="text-xs font-semibold text-slate-500 px-3 py-1.5 mt-2 select-none"
                >
                  {watchedIPOs.map((ipo) => (
                    <Command.Item
                      key={`watched-${ipo.id}`}
                      onSelect={() => navigate(`/ipo/${ipo.id}`)}
                      className="flex items-center justify-between px-3 py-2 text-sm rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-100 transition-colors outline-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
                        <span className="truncate">{ipo.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ipo.gmp !== undefined && (
                          <span className="text-xs text-emerald-400 font-mono">
                            ₹{ipo.gmp} GMP
                          </span>
                        )}
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            // cmdk fires onSelect on click — stop it or
                            // unwatching also navigates to the IPO page.
                            e.preventDefault();
                            e.stopPropagation();
                            toggleWatch(ipo.id);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1"
                          title="Remove from Watchlist"
                        >
                          <Star className="h-3.5 w-3.5 fill-current" />
                        </button>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Active & Upcoming IPOs */}
              {activeIPOs.length > 0 && (
                <Command.Group
                  heading="Open & Upcoming Issues"
                  className="text-xs font-semibold text-slate-500 px-3 py-1.5 mt-2 select-none"
                >
                  {activeIPOs.map((ipo) => (
                    <Command.Item
                      key={ipo.id}
                      onSelect={() => navigate(`/ipo/${ipo.id}`)}
                      className="flex items-center justify-between px-3 py-2 text-sm rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-100 transition-colors outline-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Flame className={cn("h-4 w-4 shrink-0", ipo.lifecycle === "open" ? "text-emerald-400 animate-pulse" : "text-slate-500")} />
                        <span className="truncate">{ipo.name}</span>
                        <span className={cn(
                          "text-[9px] px-1 rounded font-normal uppercase shrink-0",
                          ipo.board === "mainboard" ? "bg-slate-800 text-slate-300" : "border border-slate-700 text-slate-400"
                        )}>
                          {ipo.board === "mainboard" ? "Main" : "SME"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ipo.gmp !== undefined && (
                          <span className="text-xs text-emerald-400 font-mono">
                            +{ipo.gmpPercent}%
                          </span>
                        )}
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            toggleWatch(ipo.id);
                          }}
                          className={cn("p-1 hover:text-amber-400", isWatched(ipo.id) ? "text-amber-400" : "text-slate-600")}
                        >
                          <Star className="h-3.5 w-3.5 fill-current" />
                        </button>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Other IPOs */}
              {otherIPOs.length > 0 && (
                <Command.Group
                  heading="Closed & Listed Issues"
                  className="text-xs font-semibold text-slate-500 px-3 py-1.5 mt-2 select-none"
                >
                  {otherIPOs.slice(0, 15).map((ipo) => (
                    <Command.Item
                      key={ipo.id}
                      onSelect={() => navigate(`/ipo/${ipo.id}`)}
                      className="flex items-center justify-between px-3 py-2 text-sm rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-100 transition-colors outline-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Tag className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="truncate">{ipo.name}</span>
                        <span className="text-[9px] text-slate-500 lowercase">
                          ({ipo.lifecycle})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ipo.listingGainPercent !== undefined ? (
                          <span className={cn("text-xs font-semibold font-mono", ipo.listingGainPercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {ipo.listingGainPercent >= 0 ? "+" : ""}{ipo.listingGainPercent}%
                          </span>
                        ) : ipo.gmp !== undefined ? (
                          <span className="text-xs text-slate-500 font-mono">
                            ₹{ipo.gmp} GMP
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            toggleWatch(ipo.id);
                          }}
                          className={cn("p-1 hover:text-amber-400", isWatched(ipo.id) ? "text-amber-400" : "text-slate-600")}
                        >
                          <Star className="h-3.5 w-3.5 fill-current" />
                        </button>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>

            {/* Footer / Shortcut info */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/50 px-4 py-3 text-[11px] text-slate-500 select-none">
              <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
                <span className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-slate-300">↑↓</span>
                <span>Navigate</span>
                <span className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-slate-300 ml-2">↵</span>
                <span>Select</span>
                <span className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-slate-300 ml-2">Esc</span>
                <span>Close</span>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                <span>IPO Desk Search</span>
              </div>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
