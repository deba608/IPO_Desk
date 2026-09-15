"use client";

/**
 * ClientPageLoader — thin client wrapper so we can use `ssr: false`
 * (which Next.js 16 Turbopack forbids inside Server Components).
 *
 * page.tsx (Server Component) imports this instead of calling
 * dynamic(..., { ssr: false }) directly.
 */
import dynamic from "next/dynamic";

const ClientPage = dynamic(() => import("./client-page"), { ssr: false });

export default function ClientPageLoader() {
  return <ClientPage />;
}
