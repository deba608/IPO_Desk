import { NextResponse } from "next/server";
import { solveBigShareCaptcha } from "@/services/captcha.service";
import { getClientKey, isRateLimited } from "@/lib/rate-limit";

export async function GET(request: Request) {
  // Each hit burns shared OCR quota and upstream Bigshare calls — cap it.
  if (isRateLimited(`bigshare-captcha:${getClientKey(request)}`, 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const solution = await solveBigShareCaptcha();
    return NextResponse.json(solution);
  } catch {
    return NextResponse.json(
      { error: "Captcha unavailable. Try again." },
      { status: 500 }
    );
  }
}