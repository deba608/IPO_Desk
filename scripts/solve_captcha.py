#!/usr/bin/env python3
"""Local Bigshare CAPTCHA solver using ddddocr.

Reads a base64-encoded PNG/JPEG from stdin, prints the recognised text
(digits) to stdout. Exits non-zero on any failure so the Node caller can
fall back to the remote OCR.Space path.

Usage:
    echo "<base64>" | python3 scripts/solve_captcha.py
    echo "<base64>" | python3 scripts/solve_captcha.py --timeout-ignored

Only stdlib + ddddocr + pillow are required (both already in the Dockerfile).
"""
import base64
import re
import sys


def main() -> int:
    raw = sys.stdin.read().strip()
    if not raw:
        print("empty input", file=sys.stderr)
        return 1
    # Tolerate data-URL prefix.
    if "," in raw and raw.startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        image_bytes = base64.b64decode(raw)
    except Exception as exc:  # noqa: BLE001
        print(f"base64 decode failed: {exc}", file=sys.stderr)
        return 1
    if not image_bytes:
        print("empty image", file=sys.stderr)
        return 1

    try:
        import ddddocr  # type: ignore
    except Exception as exc:  # noqa: BLE001
        print(f"ddddocr unavailable: {exc}", file=sys.stderr)
        return 2

    try:
        ocr = ddddocr.DdddOcr(show_ad=False)
        text = ocr.classification(image_bytes) or ""
    except Exception as exc:  # noqa: BLE001
        print(f"ocr failed: {exc}", file=sys.stderr)
        return 1

    # Bigshare captchas are 6 digits; be lenient and emit whatever we got —
    # the Node side validates with the same extractAnswer rules.
    text = text.strip()
    digits = re.sub(r"\D", "", text)
    out = digits if digits else text
    if not out:
        print("ocr returned empty text", file=sys.stderr)
        return 1
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
