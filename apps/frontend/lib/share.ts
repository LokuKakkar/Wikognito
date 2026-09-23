export interface ShareResultInput {
  puzzleNumber: number;
  won: boolean;
  guessCount: number;
  durationMs: number;
  puzzleId: string;
  origin?: string;
  accuracy?: number | null;
}

export interface ShareVisualInput {
  puzzleNumber: number;
  won: boolean;
  guessCount: number;
  durationMs: number;
  accuracy?: number | null;
  puzzleId: string;
}

const FOG_BLOCKS = 12;

export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function formatAccuracy(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${Math.round(value * 100)}%`;
}

export function formatClock(startedAt?: number, completedAt?: number | null, now = Date.now()): string {
  if (!startedAt) return "00:00";
  const totalSec = Math.max(0, Math.floor(((completedAt ?? now) - startedAt) / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatTitleSlots(filled: number, slots: number): string {
  const total = Math.max(0, slots);
  const on = Math.min(total, Math.max(0, filled));
  if (total === 0) return "";
  return `${"■".repeat(on)}${"□".repeat(total - on)}`;
}

export function formatFogStrip(revealed: number, total: number, blocks = FOG_BLOCKS): string {
  if (total <= 0) return "□".repeat(blocks);
  const filled = Math.round(Math.min(1, Math.max(0, revealed / total)) * blocks);
  return `${"█".repeat(filled)}${"░".repeat(blocks - filled)}`;
}

export function formatShareUrl(puzzleId: string, origin?: string): string {
  const base = (origin ?? (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  return base ? `${base}/?puzzle=${encodeURIComponent(puzzleId)}` : `/?puzzle=${encodeURIComponent(puzzleId)}`;
}

export function formatShareResult(input: ShareResultInput): string {
  const link = formatShareUrl(input.puzzleId, input.origin);
  const accuracy = formatAccuracy(input.accuracy);
  return [
    `WIKOGNITO #${input.puzzleNumber}`,
    input.won ? "Won" : "Gave up",
    `${input.guessCount} guesses`,
    formatDurationMs(input.durationMs),
    ...(accuracy ? [`${accuracy} accuracy`] : []),
    "",
    link,
  ].join("\n");
}

export function renderShareCard(input: ShareVisualInput): HTMLCanvasElement {
  const width = 720;
  const height = 420;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#ded3bd";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#cfc5b1";
  ctx.fillRect(0, 0, width, 8);
  ctx.fillRect(0, height - 8, width, 8);

  ctx.fillStyle = "#6b4c10";
  ctx.font = "700 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.fillText("WIKOGNITO", 48, 64);
  ctx.fillStyle = "#1e1a15";
  ctx.font = "700 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.fillText(`#${input.puzzleNumber}`, 180, 64);

  ctx.font = "700 28px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(input.won ? "Won" : "Gave up", 48, 118);

  const accuracy = formatAccuracy(input.accuracy);
  const stats = [
    `${input.guessCount} guesses`,
    accuracy ? `${accuracy} accuracy` : null,
    formatDurationMs(input.durationMs),
  ].filter((item): item is string => Boolean(item));

  ctx.fillStyle = "#1e1a15";
  ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(stats.join("   ·   "), 48, 188);

  ctx.fillStyle = "#6b4c10";
  ctx.font = "400 18px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("Play at Wikognito — answer not included", 48, 360);
  return canvas;
}

export async function copyShareImage(input: ShareVisualInput): Promise<boolean> {
  if (typeof document === "undefined" || typeof navigator === "undefined") return false;
  const canvas = renderShareCard(input);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), "image/png");
  });
  if (!blob || !navigator.clipboard || typeof ClipboardItem === "undefined") return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}
