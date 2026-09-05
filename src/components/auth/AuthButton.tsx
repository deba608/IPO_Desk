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
    }).catch(() => {});
  }, [status]);

  if (status === "loading") {
    return (
      <span
        aria-hidden
        className={cn(
          "animate-pulse rounded-lg bg-muted",
          compact ? "h-9 w-9" : "h-9 w-24"
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
          "inline-flex items-center gap-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary",
          compact ? "h-9 w-9 justify-center" : "h-9 px-3"
        )}
        aria-label="Sign in with Google"
        title="Sign in with Google"
      >
        <LogIn className="h-4 w-4" />
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
        title={session.user.email ?? "Account"}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-sm font-semibold text-foreground transition-colors hover:border-primary/50"
      >
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
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
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-border bg-card p-3 shadow-2xl">
            <p className="truncate text-xs font-medium text-foreground">
              {session.user.name ?? "Google user"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {session.user.email}
            </p>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                signOut();
              }}
              className="mt-2.5 flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
