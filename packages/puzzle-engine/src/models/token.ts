import type { TokenType } from "@redactle/shared";

/** Internal token used during generation (may include plaintext). */
export interface PuzzleToken {
  tokenId: string;
  type: TokenType;
  wordLength?: number;
  inTitle?: boolean;
  redacted?: boolean;
  matchKey?: string;
  /** Original display value — server-side only for redacted words. */
  displayValue?: string;
}
