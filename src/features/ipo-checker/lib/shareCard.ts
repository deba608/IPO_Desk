// shareCard — renders a branded PNG summary of an allotment result on a <canvas>
// (no external deps) and shares it via the Web Share API, falling back to a
// download. Used by the "Share" button on the results dashboards.

export interface ShareCardData {
  title: string;
  /** e.g. "GENXAI ANALYTICS LIMITED" or "Scan · 60 IPOs" */
  subtitle: string;
  /** Big highlighted figure, e.g. "2 / 4 allotted" */
  headline: string;
  /** Whether the headline is a "win" (green) or neutral. */
  positive: boolean;
  /** Up to 4 label/value stat chips. */
  stats: { label: string; value: string }[];
}

const W = 1080;
const H = 1080;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawShareCard(data: ShareCardData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1120");
  bg.addColorStop(1, "#0f172a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Accent glow
  const glow = ctx.createRadialGradient(W * 0.8, 120, 50, W * 0.8, 120, 600);
  glow.addColorStop(0, data.positive ? "rgba(16,185,129,0.22)" : "rgba(99,102,241,0.20)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const pad = 90;

  // Brand
  ctx.fillStyle = "#818cf8";
  ctx.font = "700 40px Arial, sans-serif";
  ctx.fillText("IPO Desk", pad, pad + 30);
  ctx.fillStyle = "#64748b";
  ctx.font = "400 30px Arial, sans-serif";
  ctx.fillText(data.title, pad, pad + 78);

  // Subtitle (IPO name) — wrap to width
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "700 56px Arial, sans-serif";
  wrapText(ctx, data.subtitle, pad, 360, W - pad * 2, 66, 2);

  // Headline figure
  ctx.fillStyle = data.positive ? "#34d399" : "#cbd5e1";
  ctx.font = "800 92px Arial, sans-serif";
  ctx.fillText(data.headline, pad, 560);

  // Stat chips (2x2)
  const chipW = (W - pad * 2 - 30) / 2;
  const chipH = 150;
  data.stats.slice(0, 4).forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (chipW + 30);
    const y = 660 + row * (chipH + 30);
    ctx.fillStyle = "rgba(148,163,184,0.10)";
    roundRect(ctx, x, y, chipW, chipH, 24);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 28px Arial, sans-serif";
    ctx.fillText(s.label.toUpperCase(), x + 34, y + 54);
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "700 60px Arial, sans-serif";
    ctx.fillText(s.value, x + 34, y + 116);
  });

  // Footer
  ctx.fillStyle = "#475569";
  ctx.font = "400 28px Arial, sans-serif";
  ctx.fillText("Check your IPO allotment instantly", pad, H - pad);

  return canvas;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (let n = 0; n < words.length; n++) {
    const test = line ? `${line} ${words[n]}` : words[n];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = words[n];
      y += lineHeight;
      if (++lines >= maxLines - 1) {
        // last allowed line — truncate remainder with ellipsis
        let rest = words.slice(n).join(" ");
        while (ctx.measureText(rest + "…").width > maxWidth && rest.length > 0) {
          rest = rest.slice(0, -1);
        }
        ctx.fillText(rest + (n < words.length ? "…" : ""), x, y);
        return;
      }
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png"
    )
  );
}

export type ShareOutcome = "shared" | "downloaded";

/**
 * Renders the card and shares it. Prefers the Web Share API (with file) when
 * available (mobile), otherwise downloads a PNG. Returns which path was taken.
 */
export async function shareResultCard(
  data: ShareCardData,
  filename = "ipo-allotment.png"
): Promise<ShareOutcome> {
  const canvas = drawShareCard(data);
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], filename, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: "IPO Desk", text: data.headline });
      return "shared";
    } catch (err) {
      // User cancelled the share sheet — don't fall through to a download.
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
      // Otherwise fall back to download below.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return "downloaded";
}
