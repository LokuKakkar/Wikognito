import type { ClientPuzzleToken } from "@redactle/shared";
import { expandInflectionalForms } from "../inflection/expand-forms.js";
import { normalizeGuess } from "../normalizer/word-normalizer.js";

export interface MatchResult {
  normalizedGuess: string | null;
  matchedTokenIds: string[];
  hitCount: number;
  isCorrect: boolean;
}

/**
 * Match a guess against client puzzle tokens by matchKey,
 * including inflectional variants of the guess (e.g. dog → dogs).
 * Pure function — no network, no React.
 */
export function matchGuess(tokens: ClientPuzzleToken[], guess: string): MatchResult {
  const normalizedGuess = normalizeGuess(guess);
  if (!normalizedGuess) {
    return {
      normalizedGuess: null,
      matchedTokenIds: [],
      hitCount: 0,
      isCorrect: false,
    };
  }

  const forms = expandInflectionalForms(normalizedGuess);
  const matchedTokenIds = tokens
    .filter((token) => token.redacted && !!token.matchKey && forms.has(token.matchKey))
    .map((token) => token.tokenId);

  return {
    normalizedGuess,
    matchedTokenIds,
    hitCount: matchedTokenIds.length,
    isCorrect: matchedTokenIds.length > 0,
  };
}
