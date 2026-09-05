// src/app/api/admin/logout/route.ts
// Clears the signed `ipodesk_admin` session cookie so "Lock Console"
// actually revokes the session on shared machines.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookieName } from "@/services/admin-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = await cookies();
  store.set(adminSessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return NextResponse.json({ ok: true });
}
