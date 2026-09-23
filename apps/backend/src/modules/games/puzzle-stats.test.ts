import { describe, expect, it } from "vitest";
import { median, recomputePuzzleStats } from "./puzzle-stats.js";

describe("puzzle stats aggregates", () => {
  it("computes medians and histogram from official daily rows", () => {
    const stats = recomputePuzzleStats("puzzle-1", [
      { guessCount: 10, hitGuessCount: 8, durationMs: 60_000, won: true, status: "WON" },
      { guessCount: 20, hitGuessCount: 10, durationMs: 120_000, won: true, status: "WON" },
      { guessCount: 30, hitGuessCount: 6, durationMs: 40_000, won: false, status: "GAVE_UP" },
    ]);

    expect(stats.gamesPlayed).toBe(3);
    expect(stats.gamesWon).toBe(2);
    expect(stats.gamesGaveUp).toBe(1);
    expect(stats.medianGuessCount).toBe(20);
    expect(stats.medianDurationMs).toBe(60_000);
    expect(stats.medianAccuracy).toBeCloseTo(0.5);
    expect(stats.guessHistogram).toEqual({ "10": 1, "20": 1, "30": 1 });
  });

  it("returns empty aggregates with no rows", () => {
    const stats = recomputePuzzleStats("puzzle-empty", []);
    expect(stats.gamesPlayed).toBe(0);
    expect(stats.medianGuessCount).toBeNull();
    expect(stats.guessHistogram).toEqual({});
  });

  it("averages the two middle values for an even-length median", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([8])).toBe(8);
    expect(median([])).toBeNull();
  });
});
