"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";
import { getDeviceId } from "@/hooks/useAlerts";
import { cn } from "@/lib/utils";

/**
 * Header auth control: Google sign-in when logged out, avatar menu when in.
 * After login, anonymous (device-scoped) alerts are linked to the user once.
 */
export function AuthButton({ compact = false }: { compact?: boolean }) {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const linkedRef = useRef(false);

  // One-time silent migration of anonymous alerts to the user account.
  useEffect(() => {
    if (status !== "authenticated" || linkedRef.current) return;
    linkedRef.current = true;
    const deviceId = getDeviceId();
    if (!deviceId) return;
    fetch("/api/alerts/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    }).catch(() => {
      // Best-effort migration; failures stay device-scoped.
    });
  }, [status]);

  // Escape closes the account menu; focus is returned by React re-render.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (status === "loading") {
    return (
      <span
        role="status"
        aria-label="Loading account"
        className={cn(
          "animate-pulse rounded-lg bg-muted",
          compact ? "h-10 w-10" : "h-9 w-24"
        )}
      />
    );
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground outline-none transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          compact ? "h-10 w-10 justify-center" : "h-9 px-3"
        )}
        aria-label="Sign in with Google"
        title="Sign in with Google"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        {!compact && <span className="text-xs">Sign in</span>}
      </button>
    );
  }

  const initial = (session.user.name ?? session.user.email ?? "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        title={session.user.email ?? "Account"}
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-sm font-semibold text-foreground outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            width={40}
            height={40}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          initial
        )}
      </button>
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close account menu"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="menu"
            aria-label="Account"
            className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-border bg-card p-3 shadow-2xl"
          >
            <p className="truncate text-xs font-medium text-foreground">
              {session.user.name ?? "Google user"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                signOut();
              }}
              className="mt-2.5 flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
