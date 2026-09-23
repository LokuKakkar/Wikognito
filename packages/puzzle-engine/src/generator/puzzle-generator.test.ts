import { describe, expect, it } from "vitest";
import type { ClientPuzzle, ClientPuzzleToken } from "@redactle/shared";
import { generatePuzzle } from "./puzzle-generator.js";
import { decodeClientPayload } from "../codec/payload.js";
import { toCompactPuzzle } from "../codec/compact.js";
import { createGame } from "../game/game-engine.js";
import { simulateTitleWin } from "../game/simulate-win.js";

function makePuzzle(title: string, body: string) {
  return generatePuzzle({
    puzzleId: "puzzle-test",
    puzzleNumber: 1,
    scheduledDate: "2026-08-20",
    generatorVersion: "2.0.0",
    title,
    body,
  });
}

function titleTokens(puzzle: ClientPuzzle): ClientPuzzleToken[] {
  const separator = puzzle.content.findIndex((token) => token.displayValue === "\n\n");
  return puzzle.content.slice(0, separator === -1 ? puzzle.content.length : separator);
}

function renderTokens(tokens: ClientPuzzleToken[]): string {
  return tokens
    .map((token) => {
      if (token.type !== "word") return token.displayValue ?? "";
      if (!token.redacted) return token.displayValue ?? "";
      return "█".repeat(token.wordLength ?? token.matchKey?.length ?? 1);
    })
    .join("");
}

describe("puzzle generator title and common-word rules", () => {
  it("keeps common title words visible and wins on the remaining title tokens", () => {
    const generated = makePuzzle(
      "The Lord of the Rings",
      "The Lord of the Rings is a novel. Lord and Rings appear in the title.",
    );
    const puzzle = decodeClientPayload(generated.publicDto.payload);

    expect(puzzle.title).toBe("The Lord of the Rings");
    expect(renderTokens(titleTokens(puzzle))).toBe("The ████ of the █████");

    const requiredKeys = puzzle.content
      .filter((token) => puzzle.titleTokenIds.includes(token.tokenId))
      .map((token) => token.matchKey);
    expect(requiredKeys.every((key) => key === "lord" || key === "rings")).toBe(true);
    expect(requiredKeys).not.toContain("the");
    expect(requiredKeys).not.toContain("of");

    const game = createGame(puzzle);
    game.guess("the");
    game.guess("of");
    expect(game.getState().status).toBe("IN_PROGRESS");
    game.guess("lord");
    expect(game.getState().status).toBe("IN_PROGRESS");
    expect(game.guess("rings").status).toBe("WON");
  });

  it("uses the same tokenizer for hyphenated titles", () => {
    const generated = makePuzzle("Spider-Man", "Spider-Man is a superhero.");
    const puzzle = decodeClientPayload(generated.publicDto.payload);
    expect(renderTokens(titleTokens(puzzle))).toBe("██████-███");

    const game = createGame(puzzle);
    game.guess("spider");
    expect(game.getState().status).toBe("IN_PROGRESS");
    expect(game.guess("man").status).toBe("WON");
  });

  it("treats apostrophes in titles as visible separators", () => {
    const generated = makePuzzle("Einstein's Theory", "Einstein's Theory is famous.");
    const puzzle = decodeClientPayload(generated.publicDto.payload);
    expect(renderTokens(titleTokens(puzzle))).toBe("████████'█ ██████");

    const game = createGame(puzzle);
    game.guess("einstein");
    expect(game.getState().status).toBe("IN_PROGRESS");
    game.guess("s");
    expect(game.getState().status).toBe("IN_PROGRESS");
    expect(game.guess("theory").status).toBe("WON");
  });

  it("keeps numeric title tokens guessable", () => {
    const generated = makePuzzle("Apollo 11", "Apollo 11 landed on the moon.");
    const puzzle = decodeClientPayload(generated.publicDto.payload);
    expect(renderTokens(titleTokens(puzzle))).toBe("██████ ██");

    const game = createGame(puzzle);
    game.guess("apollo");
    expect(game.getState().status).toBe("IN_PROGRESS");
    expect(game.guess("11").status).toBe("WON");
  });

  it("stores the title string once while titleTokenIndexes may include body occurrences", () => {
    const generated = makePuzzle(
      "Pet door",
      `Pet door is an opening that allows a pet to enter.
A Pet door can be installed in a wall or a door.
Another Pet door may include a magnetic flap.`,
    );
    const puzzle = decodeClientPayload(generated.publicDto.payload);
    const compact = toCompactPuzzle(puzzle);

    expect(puzzle.title).toBe("Pet door");
    expect(compact.title).toBe("Pet door");
    expect(compact.titleTokenIndexes.length).toBeGreaterThan(2);
    expect(
      compact.titleTokenIndexes.every(
        (index) => index >= 0 && index < compact.stream.length,
      ),
    ).toBe(true);

    const game = createGame(puzzle);
    game.guess("pet");
    expect(game.getState().status).toBe("IN_PROGRESS");
    expect(game.guess("door").status).toBe("WON");
    expect(game.getTitleDisplay()).toBe("Pet door");
  });

  it("simulates a title win without a browser", () => {
    const puzzle = decodeClientPayload(
      makePuzzle("The Lord of the Rings", "The Lord of the Rings is a novel.").publicDto.payload,
    );
    expect(simulateTitleWin(puzzle).won).toBe(true);
  });
});
