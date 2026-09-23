import type { ClientPuzzle } from "@redactle/shared";
import { matchGuess } from "../matcher/matcher.js";

/**
 * Count guesses that revealed at least one newly matched redacted token.
 * Duplicates and zero-hit guesses do not count.
 */
export function countHitGuesses(puzzle: ClientPuzzle, guesses: string[]): number {
  const revealed = new Set<string>();
  let hitGuessCount = 0;

  for (const guess of guesses) {
    const match = matchGuess(puzzle.content, guess);
    if (!match.normalizedGuess) continue;

    const newlyRevealed = match.matchedTokenIds.filter((tokenId) => !revealed.has(tokenId));
    for (const tokenId of match.matchedTokenIds) {
      revealed.add(tokenId);
    }
    if (newlyRevealed.length > 0) {
      hitGuessCount += 1;
    }
  }

  return hitGuessCount;
}

export function guessAccuracy(hitGuessCount: number, guessCount: number): number | null {
  if (guessCount <= 0) return null;
  return hitGuessCount / guessCount;
}
