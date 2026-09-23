import { describe, expect, it } from "vitest";
import type { ClientPuzzle } from "./types/tokens.js";
import { applyPlayDifficulty, visibleWordsForDifficulty } from "./constants/index.js";

function samplePuzzle(): ClientPuzzle {
  return {
    puzzleId: "puzzle-sample",
    puzzleNumber: 1,
    scheduledDate: "2026-09-22",
    generatorVersion: "2.0.0",
    title: "Why Make",
    titleTokenIds: ["t-why", "t-make"],
    content: [
      {
        tokenId: "t-why",
        type: "word",
        matchKey: "why",
        displayValue: "Why",
        redacted: true,
        wordLength: 3,
        inTitle: true,
      },
      {
        tokenId: "t-make",
        type: "word",
        matchKey: "make",
        displayValue: "Make",
        redacted: true,
        wordLength: 4,
        inTitle: true,
      },
      {
        tokenId: "t-i",
        type: "word",
        matchKey: "i",
        displayValue: "I",
        redacted: true,
        wordLength: 1,
      },
      {
        tokenId: "t-city",
        type: "word",
        matchKey: "city",
        displayValue: "city",
        redacted: true,
        wordLength: 4,
      },
      {
        tokenId: "t-the",
        type: "word",
        matchKey: "the",
        displayValue: "The",
        redacted: false,
        wordLength: 3,
      },
    ],
  };
}

describe("visible words by difficulty", () => {
  it("keeps hard on the original common-word list", () => {
    const hard = visibleWordsForDifficulty("hard");
    expect(hard.has("the")).toBe(true);
    expect(hard.has("did")).toBe(true);
    expect(hard.has("i")).toBe(false);
    expect(hard.has("make")).toBe(false);
  });

  it("adds pronouns and quantities on medium, and everyday words on easy", () => {
    const medium = visibleWordsForDifficulty("medium");
    expect(medium.has("the")).toBe(true);
    expect(medium.has("i")).toBe(true);
    expect(medium.has("themselves")).toBe(true);
    expect(medium.has("having")).toBe(true);
    expect(medium.has("make")).toBe(false);
    expect(medium.has("because")).toBe(false);

    const easy = visibleWordsForDifficulty("easy");
    expect(easy.has("i")).toBe(true);
    expect(easy.has("make")).toBe(true);
    expect(easy.has("whenever")).toBe(true);
    expect(easy.has("city")).toBe(false);
  });
});

describe("applyPlayDifficulty", () => {
  it("leaves a hard puzzle unchanged", () => {
    const puzzle = samplePuzzle();
    expect(applyPlayDifficulty(puzzle, "hard")).toBe(puzzle);
  });

  it("opens medium words and still requires easy-only title words", () => {
    const medium = applyPlayDifficulty(samplePuzzle(), "medium");
    expect(medium.content.find((token) => token.tokenId === "t-i")?.redacted).toBe(false);
    expect(medium.content.find((token) => token.tokenId === "t-make")?.redacted).toBe(true);
    expect(medium.content.find((token) => token.tokenId === "t-city")?.redacted).toBe(true);
    expect(medium.titleTokenIds).toEqual(["t-why", "t-make"]);
  });

  it("opens easy words, including title words, so they are not required to win", () => {
    const easy = applyPlayDifficulty(samplePuzzle(), "easy");
    expect(easy.content.find((token) => token.tokenId === "t-why")?.redacted).toBe(false);
    expect(easy.content.find((token) => token.tokenId === "t-why")?.displayValue).toBe("Why");
    expect(easy.content.find((token) => token.tokenId === "t-make")?.redacted).toBe(false);
    expect(easy.content.find((token) => token.tokenId === "t-i")?.redacted).toBe(false);
    expect(easy.content.find((token) => token.tokenId === "t-city")?.redacted).toBe(true);
    expect(easy.titleTokenIds).toEqual([]);
  });
});
