"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, History, SearchCode, Search, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Calendar;
  iconClass: string;
  isActive: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/calendar",
    label: "Calendar",
    icon: Calendar,
    iconClass: "text-emerald-400",
    isActive: (p) => p === "/calendar" || p.startsWith("/ipo/"),
  },
  {
    href: "/",
    label: "Allotment Checker",
    icon: SearchCode,
    iconClass: "text-primary",
    isActive: (p) => p === "/",
  },
  {
    href: "/history",
    label: "History",
    icon: History,
    iconClass: "text-amber-400",
    isActive: (p) => p === "/history",
  },
];

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const openSearch = () => {
    window.dispatchEvent(new Event("open-command-palette"));
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="IPO Desk"
            width={36}
            height={36}
            className="rounded-lg shrink-0"
            style={{ height: "auto" }}
            priority
          />
          <span className="text-lg font-bold tracking-tight">IPO Desk</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm md:flex">
          {NAV_ITEMS.map(({ href, label, icon: Icon, iconClass, isActive }) => {
            const active = isActive(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 font-medium transition-colors",
                  active
                    ? "bg-[rgba(99,102,241,0.15)] text-primary"
                    : "text-muted-foreground hover:bg-[rgba(30,41,59,0.6)] hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-primary" : iconClass)} />
                {label}
              </Link>
            );
          })}

          {/* Search trigger */}
          <button
            type="button"
            onClick={openSearch}
            aria-label="Open search"
            className="ml-2 flex items-center gap-2 rounded-lg border border-border/60 bg-[rgba(30,41,59,0.6)] px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Search className="h-4 w-4" />
            <span className="hidden text-sm lg:inline">Search</span>
            <kbd className="ml-1 hidden rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-fg-dim lg:inline">
              ⌘K
            </kbd>
          </button>
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Open search"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[rgba(30,41,59,0.6)] hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[rgba(30,41,59,0.6)] hover:text-foreground"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <nav className="glass border-t border-border/50 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon, iconClass, isActive }) => {
              const active = isActive(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[rgba(99,102,241,0.15)] text-primary"
                      : "text-muted-foreground hover:bg-[rgba(30,41,59,0.6)] hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-primary" : iconClass)} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
