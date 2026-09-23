import { describe, expect, it } from "vitest";
import { formatUtcDate, readyPuzzleId, utcDateOnly } from "../pipeline/persist.js";

describe("puzzle persist helpers", () => {
  it("formats UTC date-only keys", () => {
    const date = new Date("2026-08-20T15:30:00.000Z");
    expect(formatUtcDate(date)).toBe("2026-08-20");
    expect(utcDateOnly(date).toISOString().startsWith("2026-08-20")).toBe(true);
  });

  it("builds stable ready puzzle ids from article and generator version", () => {
    expect(readyPuzzleId("article-ada-lovelace", "2.0.0")).toBe(
      "puzzle-article-ada-lovelace-2-0-0",
    );
  });
});
