// src/services/captcha.service.ts
// Bigshare CAPTCHA solver. Fetches a fresh CAPTCHA from Bigshare and solves
// the image with the local Python ddddocr install.
//
// Shared by the /api/bigshare/captcha route AND the BigShareAdapter directly.
// The adapter must NOT self-HTTP to its own API route (relative URLs are
// invalid server-side), so the Python logic lives here.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PYTHON_SCRIPT = `
import urllib.request, ssl, json, base64, ddddocr

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

    ocr = ddddocr.DdddOcr(show_ad=False)
    result = ocr.classification(data)
    print(json.dumps({"token": token, "answer": result}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

export interface CaptchaSolution {
  token: string;
  answer: string;
}

/**
 * Fetch and solve a fresh Bigshare CAPTCHA. Throws when Python/ddddocr is
 * unavailable (e.g. a serverless host without a Python runtime) or the
 * CAPTCHA service is unreachable.
 */
export async function solveBigShareCaptcha(): Promise<CaptchaSolution> {
  const pythonExe = process.platform === "win32" ? "python" : "python3";
  const { stdout } = await execFileAsync(pythonExe, ["-c", PYTHON_SCRIPT], {
    timeout: 30000,
  });

  const lines = stdout.trim().split("\n");
  const lastLine = lines[lines.length - 1];
  const parsed = JSON.parse(lastLine) as Partial<CaptchaSolution> & { error?: string };

  if (parsed.error || !parsed.token || !parsed.answer) {
    throw new Error(parsed.error ?? "CAPTCHA solver returned an incomplete result");
  }

  return { token: parsed.token, answer: parsed.answer };
}