import { describe, expect, it } from "vitest";
import { formatFogStrip, formatShareResult, formatShareUrl, formatTitleSlots } from "../lib/share";

describe("formatShareResult", () => {
  it("omits the answer and private fields", () => {
    const text = formatShareResult({
      puzzleNumber: 183,
      won: true,
      guessCount: 42,
      durationMs: 312_000,
      puzzleId: "puzzle-safe-id",
      origin: "http://localhost:3002",
    });
    expect(text).toContain("WIKOGNITO #183");
    expect(text).toContain("Won");
    expect(text).toContain("42 guesses");
    expect(text).toContain("5m 12s");
    expect(text).toContain("http://localhost:3002/?puzzle=puzzle-safe-id");
    expect(text).not.toMatch(/Ada|Lovelace|title|answer|article/i);
  });

  it("includes accuracy without title slots or fog glyphs", () => {
    const text = formatShareResult({
      puzzleNumber: 1,
      won: true,
      guessCount: 2,
      durationMs: 1000,
      puzzleId: "puzzle-test",
      origin: "http://localhost:3002",
      accuracy: 0.5,
    });
    expect(text).toContain("50% accuracy");
    expect(text).not.toContain("■");
    expect(text).not.toContain("█");
    expect(text).not.toContain("░");
    expect(text).not.toMatch(/Ada|Lovelace/i);
  });
});

describe("share helpers", () => {
  it("builds a puzzle link", () => {
    expect(formatShareUrl("puzzle-test", "http://localhost:3002")).toBe(
      "http://localhost:3002/?puzzle=puzzle-test",
    );
  });

  it("still renders title slots and a fog strip for legacy callers", () => {
    expect(formatTitleSlots(1, 3)).toBe("■□□");
    expect(formatFogStrip(6, 12)).toHaveLength(12);
  });
});
