import { COMMON_VISIBLE_WORDS } from "@redactle/shared";
import type { PuzzleToken } from "../models/token.js";

export interface RedactOptions {
  /** Additional words that should remain visible. */
  visibleWords?: Set<string>;
}

/**
 * Mark redactable words. Common stopwords, punctuation, and symbols stay visible
 * everywhere — including inside titles. Numbers and other non-common words are
 * guessable.
 */
export function redactTokens(tokens: PuzzleToken[], options: RedactOptions = {}): PuzzleToken[] {
  const visible = options.visibleWords ?? COMMON_VISIBLE_WORDS;

  return tokens.map((token) => {
    if (token.type !== "word" || !token.matchKey) {
      return { ...token, redacted: false };
    }

    if (visible.has(token.matchKey)) {
      return { ...token, redacted: false };
    }

    return {
      ...token,
      redacted: true,
    };
  });
}
