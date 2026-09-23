import { describe, expect, it } from "vitest";
import { applyPlayDifficulty } from "@redactle/shared";
import { generatePuzzle } from "../generator/puzzle-generator.js";
import { createGame, deserializeGameState } from "./game-engine.js";
import { normalizeWord } from "../normalizer/word-normalizer.js";
import { tokenizeText } from "../tokenizer/tokenizer.js";
import { redactTokens } from "../redactor/redactor.js";
import { matchGuess } from "../matcher/matcher.js";
import {
  decodeClientPayload,
  encodeClientPayload,
  measurePayloadSizes,
} from "../codec/payload.js";

const DUMMY_TITLE = "Ada Lovelace";
const DUMMY_BODY =
  "Ada Lovelace was an English mathematician and writer. She is known for her work on the Analytical Engine. Her notes described an algorithm that could be processed by a machine.";

function makePuzzle() {
  return generatePuzzle({
    puzzleId: "puzzle-ada",
    puzzleNumber: 1,
    scheduledDate: "2026-08-13",
    generatorVersion: "1.0.0",
    title: DUMMY_TITLE,
    body: DUMMY_BODY,
  });
}

describe("word normalizer", () => {
  it("trims, lowercases, and strips edge punctuation", () => {
    expect(normalizeWord("  Physics! ")).toBe("physics");
  });
});

describe("tokenizer and redactor", () => {
  it("redacts content words but keeps common stopwords visible", () => {
    const tokens = tokenizeText("Ada was an English mathematician.");
    const redacted = redactTokens(
      tokens.map((t) => ({
        ...t,
        inTitle: t.matchKey === "ada",
      })),
    );
    expect(redacted.find((t) => t.matchKey === "was")?.redacted).toBe(false);
    expect(redacted.find((t) => t.matchKey === "english")?.redacted).toBe(true);
  });
});

describe("opaque payload", () => {
  it("round-trips encode/decode and preserves title tokens", () => {
    const { clientPuzzle, publicDto } = makePuzzle();
    expect(publicDto.payload).toBeTruthy();
    expect(publicDto.payload.includes("mathematician")).toBe(false);
    expect(publicDto.payload.includes("Ada Lovelace")).toBe(false);

    const decoded = decodeClientPayload(publicDto.payload);
    expect(decoded.puzzleId).toBe(clientPuzzle.puzzleId);
    expect(decoded.titleTokenIds.length).toBeGreaterThan(0);
    expect(decoded.content.some((t) => t.redacted)).toBe(true);

    const again = encodeClientPayload(decoded);
    const decoded2 = decodeClientPayload(again);
    expect(decoded2.titleTokenIds).toEqual(decoded.titleTokenIds);
  });

  it("produces a compact encoded payload vs legacy JSON", () => {
    const { clientPuzzle } = makePuzzle();
    const legacy = JSON.stringify(clientPuzzle);
    const sizes = measurePayloadSizes({
      rawArticle: `${DUMMY_TITLE}\n${DUMMY_BODY}`,
      legacyClientJson: legacy,
      puzzle: clientPuzzle,
    });
    expect(sizes.encodedPayloadBytes).toBeLessThan(sizes.legacyClientJsonBytes);
    expect(sizes.compactJsonBytes).toBeLessThan(sizes.legacyClientJsonBytes);
  });
});

describe("game engine", () => {
  it("processes guesses locally with hit counts", () => {
    const puzzle = decodeClientPayload(makePuzzle().publicDto.payload);
    const game = createGame(puzzle);
    const result = game.guess("mathematician");
    expect(result.isDuplicate).toBe(false);
    expect(result.hitCount).toBeGreaterThan(0);
    expect(result.gameCompleted).toBe(false);
  });

  it("detects duplicate guesses", () => {
    const puzzle = decodeClientPayload(makePuzzle().publicDto.payload);
    const game = createGame(puzzle);
    game.guess("english");
    const dup = game.guess("English");
    expect(dup.isDuplicate).toBe(true);
    expect(game.getState().guesses).toHaveLength(1);
  });

  it("treats easy stopwords as already visible and does not count them as hits", () => {
    const decoded = decodeClientPayload(
      generatePuzzle({
        puzzleId: "puzzle-also",
        puzzleNumber: 3,
        scheduledDate: "2026-09-22",
        generatorVersion: "2.0.0",
        title: "Ada Lovelace",
        body: "I was also there. People make machines.",
      }).publicDto.payload,
    );

    const hard = createGame(applyPlayDifficulty(decoded, "hard"));
    expect(hard.guess("also").hitCount).toBeGreaterThan(0);

    const easy = createGame(applyPlayDifficulty(decoded, "easy"));
    expect(easy.guess("also").hitCount).toBe(0);
    expect(easy.guess("make").hitCount).toBe(0);
    expect(easy.guess("i").hitCount).toBe(0);
    expect(easy.getState().status).toBe("IN_PROGRESS");

    const medium = applyPlayDifficulty(decoded, "medium");
    expect(medium.content.find((token) => token.matchKey === "i")?.redacted).toBe(false);
    expect(medium.content.find((token) => token.matchKey === "also")?.redacted).toBe(true);
  });

  it("solves a title made only of easy stopwords without a guess", () => {
    const decoded = decodeClientPayload(
      generatePuzzle({
        puzzleId: "puzzle-why",
        puzzleNumber: 4,
        scheduledDate: "2026-09-22",
        generatorVersion: "2.0.0",
        title: "Why",
        body: "Why is a question people ask.",
      }).publicDto.payload,
    );
    const easy = applyPlayDifficulty(decoded, "easy");
    expect(easy.titleTokenIds).toEqual([]);
    expect(createGame(easy).getState().status).toBe("WON");
    expect(createGame(applyPlayDifficulty(decoded, "hard")).getState().status).toBe("IN_PROGRESS");
  });

  it("wins automatically when all title words are revealed", () => {
    const puzzle = decodeClientPayload(makePuzzle().publicDto.payload);
    const game = createGame(puzzle);
    expect(puzzle.titleTokenIds.length).toBeGreaterThanOrEqual(2);

    game.guess("ada");
    expect(game.getState().status).toBe("IN_PROGRESS");

    const result = game.guess("lovelace");
    expect(result.status).toBe("WON");
    expect(result.gameCompleted).toBe(true);
    expect(game.getState().completedAt).toBeTruthy();
  });

  it("displays the article title once even when it occurs many times in the body", () => {
    const generated = generatePuzzle({
      puzzleId: "puzzle-pet-door",
      puzzleNumber: 7,
      scheduledDate: "2026-08-19",
      generatorVersion: "1.0.0",
      title: "Pet door",
      body: `Pet door is an opening that allows a pet to enter.
A Pet door can be installed in a wall or a door.
Another Pet door may include a magnetic flap.`,
    });
    const puzzle = decodeClientPayload(generated.publicDto.payload);
    expect(puzzle.title).toBe("Pet door");
    expect(puzzle.titleTokenIds.length).toBeGreaterThan(2);

    const game = createGame(puzzle);
    game.guess("pet");
    expect(game.getState().status).toBe("IN_PROGRESS");
    const result = game.guess("door");
    expect(result.status).toBe("WON");
    expect(game.getTitleDisplay()).toBe("Pet door");
    expect(game.getTitleDisplay()).not.toMatch(/Pet door.*Pet door/i);
  });

  it("rejects guesses after WON", () => {
    const puzzle = decodeClientPayload(makePuzzle().publicDto.payload);
    const game = createGame(puzzle);
    game.guess("ada");
    game.guess("lovelace");
    const after = game.guess("algorithm");
    expect(after.gameCompleted).toBe(true);
    expect(game.getState().guesses).not.toContain("algorithm");
  });

  it("giveUp sets GAVE_UP with completedAt", () => {
    const puzzle = decodeClientPayload(makePuzzle().publicDto.payload);
    const game = createGame(puzzle);
    const state = game.giveUp();
    expect(state.status).toBe("GAVE_UP");
    expect(state.completedAt).toBeTruthy();
  });

  it("replay creates a new attempt id and resets guesses", () => {
    const puzzle = decodeClientPayload(makePuzzle().publicDto.payload);
    const game = createGame(puzzle);
    game.guess("ada");
    game.guess("lovelace");
    const wonAttempt = game.getState().attemptId;
    const replayed = game.replay();
    expect(replayed.status).toBe("IN_PROGRESS");
    expect(replayed.guesses).toEqual([]);
    expect(replayed.attemptId).not.toBe(wonAttempt);
    expect(replayed.completedAt).toBeNull();
  });

  it("serializes terminal state", () => {
    const puzzle = decodeClientPayload(makePuzzle().publicDto.payload);
    const game = createGame(puzzle);
    game.guess("ada");
    game.guess("lovelace");
    const restored = deserializeGameState(game.serialize());
    expect(restored?.status).toBe("WON");
    expect(restored?.attemptId).toBeTruthy();
    const game2 = createGame(puzzle, restored!);
    expect(game2.getState().status).toBe("WON");
  });

  it("keeps guess-only progress below display progress after a title win", () => {
    const puzzle = decodeClientPayload(makePuzzle().publicDto.payload);
    const game = createGame(puzzle);
    game.guess("ada");
    game.guess("lovelace");
    expect(game.getState().status).toBe("WON");
    const display = game.getProgress();
    const guessed = game.getGuessProgress();
    expect(display.revealedWords).toBe(display.totalRedactedWords);
    expect(guessed.revealedWords).toBeLessThan(guessed.totalRedactedWords);
    expect(guessed.revealedWords).toBeLessThan(display.revealedWords);
  });

  it("matches by matchKey", () => {
    const puzzle = decodeClientPayload(makePuzzle().publicDto.payload);
    const result = matchGuess(puzzle.content, "mathematician");
    expect(result.isCorrect).toBe(true);
  });

  it("reveals inflectional forms as a single guess", () => {
    const generated = generatePuzzle({
      puzzleId: "puzzle-dogs-run",
      puzzleNumber: 42,
      scheduledDate: "2026-09-21",
      generatorVersion: "1.0.0",
      title: "Park",
      body: "Dogs run and ran while running past other dogs in the park.",
    });
    const puzzle = decodeClientPayload(generated.publicDto.payload);
    const game = createGame(puzzle);

    const dogResult = game.guess("dog");
    expect(dogResult.isDuplicate).toBe(false);
    expect(dogResult.status).toBe("IN_PROGRESS");
    expect(dogResult.hitCount).toBeGreaterThanOrEqual(2);
    expect(game.getState().guesses).toEqual(["dog"]);

    const dogsDup = game.guess("dogs");
    expect(dogsDup.isDuplicate).toBe(true);
    expect(game.getState().guesses).toHaveLength(1);

    const runResult = game.guess("run");
    expect(runResult.isDuplicate).toBe(false);
    expect(runResult.hitCount).toBeGreaterThanOrEqual(3);
    expect(game.getState().guesses).toEqual(["dog", "run"]);

    const runningDup = game.guess("running");
    expect(runningDup.isDuplicate).toBe(true);
    expect(game.getState().guesses).toHaveLength(2);
  });

  it("wins when an inflectional form reveals the title", () => {
    const generated = generatePuzzle({
      puzzleId: "puzzle-title-dogs",
      puzzleNumber: 43,
      scheduledDate: "2026-09-21",
      generatorVersion: "1.0.0",
      title: "Dogs",
      body: "Dogs are common pets around the world.",
    });
    const puzzle = decodeClientPayload(generated.publicDto.payload);
    const game = createGame(puzzle);
    const result = game.guess("dog");
    expect(result.status).toBe("WON");
    expect(result.gameCompleted).toBe(true);
  });
});
