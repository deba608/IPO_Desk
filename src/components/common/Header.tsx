"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, History, SearchCode, Search, Menu, X, ChartLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthButton } from "@/components/auth/AuthButton";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Calendar;
  /** Resting icon tint (active state always uses the primary color). */
  iconClass: string;
  isActive: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Allotment Checker",
    icon: SearchCode,
    iconClass: "text-primary",
    isActive: (p) => p === "/",
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: Calendar,
    iconClass: "text-emerald-400",
    isActive: (p) => p === "/calendar" || p.startsWith("/ipo/"),
  },
  {
    href: "/backtest",
    label: "Backtest",
    icon: ChartLine,
    iconClass: "text-violet-400",
    isActive: (p) => p === "/backtest",
  },
  {
    href: "/history",
    label: "History",
    icon: History,
    iconClass: "text-amber-400",
    isActive: (p) => p === "/history",
  },
];

/** Opens the global command palette (mounted in layout, listens for this event). */
function openCommandPalette() {
  window.dispatchEvent(new Event("open-command-palette"));
}

/** Spring-like ease used for the sliding indicator + scroll shrink. */
const EASE = "cubic-bezier(0.22,1,0.36,1)";

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);


  // Sliding active-pill indicator: measure the active link's box and move a
  // single shared element to it, so switching tabs glides instead of snapping.
  const navRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    show: boolean;
    animate: boolean;
  }>({ left: 0, width: 0, show: false, animate: false });

  const activeIndex = NAV_ITEMS.findIndex((it) => it.isActive(pathname));

  useLayoutEffect(() => {
    const measure = () => {
      const el = activeIndex >= 0 ? linkRefs.current[activeIndex] : null;
      if (!el) {
        setIndicator((s) => ({ ...s, show: false }));
        return;
      }
      setIndicator((prev) => ({
        left: el.offsetLeft,
        width: el.offsetWidth,
        show: true,
        // Don't animate the very first placement (avoid a slide-in from 0).
        animate: prev.show,
      }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex, pathname]);

  // Strengthen the border + lift a shadow + shrink the bar once scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // While the mobile menu is open: close on Escape, close if the viewport grows
  // to desktop (panel is md:hidden, so it would otherwise leave scroll locked),
  // and lock body scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const onResize = () => {
      if (window.matchMedia("(min-width: 768px)").matches) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-300 [padding-top:env(safe-area-inset-top)]",
        scrolled
          ? "border-border shadow-[0_1px_0_0_rgba(255,255,255,0.04),0_12px_32px_-12px_rgba(0,0,0,0.7)]"
          : "border-border/40"
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 transition-[height] duration-300 motion-reduce:transition-none sm:px-6",
          scrolled ? "h-14" : "h-16"
        )}
        style={{ transitionTimingFunction: EASE }}
      >
        {/* Brand */}
        <Link
          href="/"
          aria-label="IPO Desk — home"
          className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Image
            src="/logo.png"
            alt=""
            width={34}
            height={34}
            className="rounded-lg shrink-0 transition-transform duration-300 ease-out group-hover:scale-105 group-hover:rotate-3 group-active:scale-95 motion-reduce:transform-none"
            style={{ width: 34, height: "auto" }}
            priority
          />
          <span className="text-base font-bold tracking-tight sm:text-lg">
            IPO Desk
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {/* Sliding indicator + the links share one relative box */}
          <div ref={navRef} className="relative flex items-center gap-1">
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-primary/20 via-primary/10 to-violet-500/10 ring-1 ring-inset ring-primary/25",
                indicator.show ? "opacity-100" : "opacity-0",
                indicator.animate
                  ? "transition-all duration-300 motion-reduce:transition-none"
                  : ""
              )}
              style={{
                left: indicator.left,
                width: indicator.width,
                height: 40,
                transitionTimingFunction: EASE,
              }}
            />
            {NAV_ITEMS.map((item, i) => {
              const { href, label, icon: Icon, iconClass, isActive } = item;
              const active = isActive(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  ref={(el) => {
                    linkRefs.current[i] = el;
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative z-10 flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:px-3",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-90 motion-reduce:transform-none",
                      active ? "text-primary" : iconClass
                    )}
                  />
                  <span className="hidden lg:inline">{label}</span>
                </Link>
              );
            })}
          </div>

          {/* Search trigger */}
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Open search (Ctrl + K)"
            className="group ml-1 flex h-10 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground outline-none transition-all duration-200 hover:border-primary/40 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 motion-reduce:active:scale-100"
          >
            <Search className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 motion-reduce:transform-none" />
            <span className="hidden lg:inline">Search</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70 leading-none">
              Ctrl + K
            </kbd>
          </button>
          <span className="ml-1">
            <AuthButton />
          </span>
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 md:hidden">
          <AuthButton compact />
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Open search"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:active:scale-100"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* Morphing hamburger ↔ close */}
            <span className="relative block h-5 w-5">
              <Menu
                className={cn(
                  "absolute inset-0 h-5 w-5 transition-all duration-300 motion-reduce:transition-none",
                  menuOpen
                    ? "rotate-90 scale-50 opacity-0"
                    : "rotate-0 scale-100 opacity-100"
                )}
                style={{ transitionTimingFunction: EASE }}
              />
              <X
                className={cn(
                  "absolute inset-0 h-5 w-5 transition-all duration-300 motion-reduce:transition-none",
                  menuOpen
                    ? "rotate-0 scale-100 opacity-100"
                    : "-rotate-90 scale-50 opacity-0"
                )}
                style={{ transitionTimingFunction: EASE }}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      <div
        id="mobile-nav"
        className={cn(
          "overflow-y-auto border-border/60 bg-background/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 ease-out motion-reduce:transition-none md:hidden",
          menuOpen ? "max-h-[70dvh] border-t opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
          {NAV_ITEMS.map(({ href, label, icon: Icon, iconClass, isActive }, i) => {
            const active = isActive(pathname);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                style={{
                  transitionDelay: menuOpen ? `${i * 45 + 60}ms` : "0ms",
                }}
                className={cn(
                  "flex h-12 transform items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-[transform,opacity,background-color,color] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                  menuOpen
                    ? "translate-y-0 opacity-100"
                    : "-translate-y-1 opacity-0",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted"
                )}
              >
                <Icon
                  className={cn("h-5 w-5", active ? "text-primary" : iconClass)}
                />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
