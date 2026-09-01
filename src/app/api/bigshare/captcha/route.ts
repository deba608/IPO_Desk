import { NextResponse } from "next/server";
import { solveBigShareCaptcha } from "@/services/captcha.service";

export async function GET() {
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