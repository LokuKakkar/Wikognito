import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../generator/puzzle-generator.js";
import { decodeClientPayload } from "../codec/payload.js";
import { countHitGuesses, guessAccuracy } from "./hit-guesses.js";

function adaPuzzle() {
  const generated = generatePuzzle({
    puzzleId: "puzzle-ada",
    puzzleNumber: 1,
    scheduledDate: "2026-08-13",
    generatorVersion: "1.0.0",
    title: "Ada Lovelace",
    body: "Ada Lovelace was an English mathematician and writer.",
  });
  return decodeClientPayload(generated.publicDto.payload);
}

describe("countHitGuesses", () => {
  it("counts guesses that newly reveal at least one token", () => {
    const puzzle = adaPuzzle();
    expect(countHitGuesses(puzzle, ["ada", "mathematician", "zzzz"])).toBe(2);
  });

  it("does not count duplicates as additional hits", () => {
    const puzzle = adaPuzzle();
    expect(countHitGuesses(puzzle, ["ada", "ada"])).toBe(1);
  });

  it("returns zero for empty or miss-only guesses", () => {
    const puzzle = adaPuzzle();
    expect(countHitGuesses(puzzle, [])).toBe(0);
    expect(countHitGuesses(puzzle, ["zzzz", ""])).toBe(0);
  });
});

describe("guessAccuracy", () => {
  it("is null when there are no guesses", () => {
    expect(guessAccuracy(0, 0)).toBeNull();
  });

  it("is the hit-guess ratio", () => {
    expect(guessAccuracy(14, 20)).toBeCloseTo(0.7);
  });
});
