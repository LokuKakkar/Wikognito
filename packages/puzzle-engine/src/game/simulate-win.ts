import type { ClientPuzzle } from "@redactle/shared";
import { createGame } from "./game-engine.js";

export interface SimulateTitleWinResult {
  won: boolean;
  guesses: string[];
}

/**
 * Guess every unique match key among required title tokens and report whether
 * the game reaches WON. Used by the puzzle validator — no browser required.
 */
export function simulateTitleWin(puzzle: ClientPuzzle): SimulateTitleWinResult {
  const titleIdSet = new Set(puzzle.titleTokenIds);
  const guesses = [
    ...new Set(
      puzzle.content
        .filter((token) => titleIdSet.has(token.tokenId) && token.matchKey)
        .map((token) => token.matchKey!),
    ),
  ];

  const game = createGame(puzzle);
  for (const guess of guesses) {
    const result = game.guess(guess);
    if (result.status === "WON") {
      return { won: true, guesses };
    }
  }

  return { won: game.getState().status === "WON", guesses };
}
