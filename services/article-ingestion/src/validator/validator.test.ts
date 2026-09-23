import { describe, expect, it } from "vitest";
import { generatePuzzle } from "@redactle/puzzle-engine";
import {
  MIN_UNIQUE_GUESSABLE_WORDS,
  PuzzleValidationError,
  validateGeneratedPuzzle,
} from "./validator.js";

function generate(title: string, body: string) {
  return generatePuzzle({
    puzzleId: "puzzle-validate",
    puzzleNumber: 0,
    scheduledDate: "",
    generatorVersion: "2.0.0",
    title,
    body,
  });
}

describe("validateGeneratedPuzzle", () => {
  it("accepts a playable article with enough guessable words", () => {
    const generated = generate(
      "Ada Lovelace",
      "Ada Lovelace was an English mathematician and writer. She is known for her work on the Analytical Engine. Her notes described an algorithm that could be processed by a machine.",
    );
    expect(() => validateGeneratedPuzzle(generated)).not.toThrow();
    expect(generated.uniqueGuessableWordCount).toBeGreaterThanOrEqual(MIN_UNIQUE_GUESSABLE_WORDS);
  });

  it("rejects disambiguation titles", () => {
    const generated = generate(
      "Mercury (disambiguation)",
      "Mercury may refer to a planet, an element, or a Roman god. Additional filler words quantum physics theory particle energy field wave matter algorithm engine.",
    );
    expect(() => validateGeneratedPuzzle(generated)).toThrow(PuzzleValidationError);
    try {
      validateGeneratedPuzzle(generated);
    } catch (error) {
      expect(error).toBeInstanceOf(PuzzleValidationError);
      expect((error as PuzzleValidationError).reason).toBe("DISAMBIGUATION");
    }
  });

  it("rejects titles with no guessable tokens", () => {
    const generated = generate(
      "The And Of",
      "The and of to in on for by with as at from is was are were be been being that this it quantum physics theory particle energy field wave matter.",
    );
    try {
      validateGeneratedPuzzle(generated);
      expect.fail("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PuzzleValidationError);
      expect((error as PuzzleValidationError).reason).toBe("NO_GUESSABLE_TITLE_TOKENS");
    }
  });

  it("rejects stubs with too few unique guessable words", () => {
    const generated = generate("Pet door", "Pet door is an opening.");
    try {
      validateGeneratedPuzzle(generated);
      expect.fail("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PuzzleValidationError);
      expect((error as PuzzleValidationError).reason).toBe("INSUFFICIENT_GUESSABLE_WORDS");
    }
  });
});
