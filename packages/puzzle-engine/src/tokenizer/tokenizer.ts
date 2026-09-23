import type { PuzzleToken } from "../models/token.js";
import { normalizeWord } from "../normalizer/word-normalizer.js";

/**
 * Word tokens are contiguous alphanumeric runs. Whitespace and every non-word
 * character (punctuation, symbols, ASCII/Unicode apostrophes, hyphens) are
 * visible boundaries and never part of a guessable token.
 */
const TOKEN_PATTERN = /(\s+)|([A-Za-z0-9]+)|([^A-Za-z0-9\s]+)/g;

export interface TokenizeOptions {
  /** Prefix for stable token IDs. */
  idPrefix?: string;
  /** Word match keys that should be marked as title words. */
  titleMatchKeys?: Set<string>;
}

/**
 * Tokenize plain text into words, whitespace, and punctuation with stable IDs.
 */
export function tokenizeText(text: string, options: TokenizeOptions = {}): PuzzleToken[] {
  const idPrefix = options.idPrefix ?? "t";
  const titleMatchKeys = options.titleMatchKeys ?? new Set<string>();
  const tokens: PuzzleToken[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    const [, whitespace, word, punctuation] = match;
    const tokenId = `${idPrefix}-${index}`;

    if (whitespace) {
      tokens.push({
        tokenId,
        type: "whitespace",
        displayValue: whitespace,
        redacted: false,
      });
    } else if (word) {
      const matchKey = normalizeWord(word);
      tokens.push({
        tokenId,
        type: "word",
        wordLength: word.length,
        displayValue: word,
        matchKey,
        inTitle: titleMatchKeys.has(matchKey),
        redacted: false,
      });
    } else if (punctuation) {
      tokens.push({
        tokenId,
        type: "punctuation",
        displayValue: punctuation,
        redacted: false,
      });
    }

    index += 1;
  }

  return tokens;
}
