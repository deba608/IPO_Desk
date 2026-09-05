import { NextResponse } from "next/server";
import { solveBigShareCaptcha } from "@/services/captcha.service";
import { getClientKey, isRateLimited } from "@/lib/rate-limit";

export async function GET(request: Request) {
  // Each hit burns shared OCR quota and upstream Bigshare calls — cap it.
  if (isRateLimited(getClientKey(request), 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const solution = await solveBigShareCaptcha();
    return NextResponse.json(solution);
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Captcha solving error", detail: errorMsg },
      { status: 500 }
    );
  }
}