import { describe, expect, it } from "vitest";
import { SCORE_MAX, SCORE_MIN, SCORE_VERSION } from "@redactle/shared";
import { computeDifficultyV1 } from "./difficulty.js";
import { calculateScoreV1 } from "./score.js";

const easyInput = {
  uniqueGuessableWordCount: 80,
  guessableWordCount: 300,
  titleTokenCount: 1,
};
const hardInput = {
  uniqueGuessableWordCount: 500,
  guessableWordCount: 2500,
  titleTokenCount: 5,
};
const easy = computeDifficultyV1(easyInput);
const hard = computeDifficultyV1(hardInput);

function score(overrides: Partial<Parameters<typeof calculateScoreV1>[0]> = {}) {
  return calculateScoreV1({
    guessCount: 30,
    durationMs: 300_000,
    hitGuessCount: 20,
    difficultyValue: 50,
    ...overrides,
  });
}

describe("computeDifficultyV1", () => {
  it("is deterministic and bounded", () => {
    expect(computeDifficultyV1(easyInput)).toEqual(computeDifficultyV1(easyInput));
    expect(easy.difficultyVersion).toBe(1);
    expect(easy.difficultyValue).toBeGreaterThanOrEqual(1);
    expect(hard.difficultyValue).toBeGreaterThan(easy.difficultyValue);
    expect(hard.difficultyValue).toBeLessThanOrEqual(100);
  });
});

describe("calculateScoreV1", () => {
  it("is deterministic and versioned", () => {
    expect(score()).toEqual(score());
    expect(score().scoreVersion).toBe(SCORE_VERSION);
  });

  it("stays within documented bounds", () => {
    expect(score({ guessCount: 1, durationMs: 1, hitGuessCount: 1 }).score).toBeLessThanOrEqual(SCORE_MAX);
    expect(score({ guessCount: 10_000, durationMs: 86_400_000, hitGuessCount: 0 }).score).toBeGreaterThanOrEqual(
      SCORE_MIN,
    );
  });

  it("rewards fewer guesses most strongly at the same difficulty", () => {
    const few = score({ guessCount: 15, hitGuessCount: 12 });
    const many = score({ guessCount: 80, hitGuessCount: 64 });
    expect(few.score).toBeGreaterThan(many.score);
  });

  it("rewards faster completion when guesses match", () => {
    const fast = score({ durationMs: 60_000 });
    const slow = score({ durationMs: 1_800_000 });
    expect(fast.score).toBeGreaterThan(slow.score);
  });

  it("gives accuracy a smaller influence than guess count", () => {
    const accurateMany = score({ guessCount: 80, hitGuessCount: 80, durationMs: 300_000 });
    const messyFew = score({ guessCount: 20, hitGuessCount: 8, durationMs: 300_000 });
    expect(messyFew.score).toBeGreaterThan(accurateMany.score);
  });

  it("normalizes harder puzzles upward for comparable play", () => {
    const onEasy = score({ difficultyValue: easy.difficultyValue });
    const onHard = score({ difficultyValue: hard.difficultyValue });
    expect(onHard.score).toBeGreaterThan(onEasy.score);
  });

  it("handles invalid inputs without throwing", () => {
    expect(score({ guessCount: 0, durationMs: -10, hitGuessCount: -3, difficultyValue: 0 }).score).toBeGreaterThanOrEqual(
      SCORE_MIN,
    );
  });
});
