"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();

  const isAllotment = pathname === "/";
  const isCalendar = pathname === "/calendar" || pathname.startsWith("/ipo/");

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
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
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/calendar"
            className={cn(
              "rounded-lg px-3 py-2 font-medium transition-colors",
              isCalendar
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Calendar
          </Link>
          <Link
            href="/"
            className={cn(
              "rounded-lg px-3 py-2 font-medium transition-colors",
              isAllotment
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Allotment Checker
          </Link>
        </nav>
      </div>
    </header>
  );
}
