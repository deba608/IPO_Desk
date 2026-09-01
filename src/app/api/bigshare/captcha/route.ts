import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function GET() {
  const pythonScript = `
import urllib.request, ssl, json, base64, subprocess, sys, os

headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    req = urllib.request.Request("https://ipo.bigshareonline.com/Captcha.ashx", headers=headers)
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        body = resp.read().decode()
        j = json.loads(body)
        token = j["token"]
        img = j["image"]
        b64 = img.split(",", 1)[1] if "," in img else img
        data = base64.b64decode(b64)

    import ddddocr
    ocr = ddddocr.DdddOcr(show_ad=False)
    result = ocr.classification(data)
    print(json.dumps({"token": token, "answer": result}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  try {
    const pythonExe = process.platform === "win32" ? "python" : "python3";
    const { stdout, stderr } = await execFileAsync(pythonExe, ["-c", pythonScript], {
      timeout: 30000,
    });

    if (stderr && !stdout) {
      return NextResponse.json(
        { error: "Captcha solving failed", detail: stderr },
        { status: 500 }
      );
    }

    const lines = stdout.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine);

    if (parsed.error) {
      return NextResponse.json(
        { error: "Captcha solving failed", detail: parsed.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ token: parsed.token, answer: parsed.answer });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Captcha solving error", detail: errorMsg },
      { status: 500 }
    );
  }
}