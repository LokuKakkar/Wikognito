import {
  CompactPuzzleV2Schema,
  decodeClientPayload,
  simulateTitleWin,
  toCompactPuzzle,
  type GeneratedPuzzle,
} from "@redactle/puzzle-engine";

export const MIN_UNIQUE_GUESSABLE_WORDS = 10;

export type PuzzleRejectReason =
  | "MISSING_TITLE"
  | "EMPTY_CONTENT"
  | "DISAMBIGUATION"
  | "NO_GUESSABLE_TITLE_TOKENS"
  | "INSUFFICIENT_GUESSABLE_WORDS"
  | "NO_REDACTED_WORDS"
  | "MALFORMED_COMPACT"
  | "DECODE_FAILED"
  | "INVALID_TITLE_INDEXES"
  | "NOT_PLAYABLE"
  | "OPAQUE_PAYLOAD_REQUIRED";

export class PuzzleValidationError extends Error {
  readonly reason: PuzzleRejectReason;

  constructor(reason: PuzzleRejectReason, message?: string) {
    super(message ?? reason);
    this.name = "PuzzleValidationError";
    this.reason = reason;
  }
}

const DISAMBIGUATION_PATTERN = /\(disambiguation\)/i;

export function validateGeneratedPuzzle(generated: GeneratedPuzzle): void {
  if (!generated.title.trim()) {
    throw new PuzzleValidationError("MISSING_TITLE", "Generated puzzle is missing a title.");
  }

  if (DISAMBIGUATION_PATTERN.test(generated.title)) {
    throw new PuzzleValidationError(
      "DISAMBIGUATION",
      "Article title looks like a disambiguation page.",
    );
  }

  if (!generated.clientPuzzle.content.length) {
    throw new PuzzleValidationError("EMPTY_CONTENT", "Generated puzzle has no content tokens.");
  }

  const redactedWords = generated.clientPuzzle.content.filter(
    (token) => token.type === "word" && token.redacted,
  );
  if (redactedWords.length === 0) {
    throw new PuzzleValidationError("NO_REDACTED_WORDS", "Generated puzzle has no redacted words.");
  }

  if (generated.clientPuzzle.titleTokenIds.length === 0 || generated.titleTokenCount === 0) {
    throw new PuzzleValidationError(
      "NO_GUESSABLE_TITLE_TOKENS",
      "Generated puzzle has no guessable title tokens.",
    );
  }

  if (generated.uniqueGuessableWordCount < MIN_UNIQUE_GUESSABLE_WORDS) {
    throw new PuzzleValidationError(
      "INSUFFICIENT_GUESSABLE_WORDS",
      `Puzzle has ${generated.uniqueGuessableWordCount} unique guessable words; need at least ${MIN_UNIQUE_GUESSABLE_WORDS}.`,
    );
  }

  if (!generated.publicDto.payload || generated.publicDto.payload.includes("{")) {
    throw new PuzzleValidationError(
      "OPAQUE_PAYLOAD_REQUIRED",
      "Public puzzle payload must be opaque/encoded.",
    );
  }

  if (!generated.titleMatchKey) {
    throw new PuzzleValidationError("MISSING_TITLE", "Generated puzzle is missing titleMatchKey.");
  }

  let decoded;
  try {
    decoded = decodeClientPayload(generated.publicDto.payload);
  } catch (error) {
    throw new PuzzleValidationError(
      "DECODE_FAILED",
      error instanceof Error ? error.message : "Failed to decode compact puzzle payload.",
    );
  }

  if (decoded.title !== generated.title) {
    throw new PuzzleValidationError(
      "MALFORMED_COMPACT",
      "Decoded compact puzzle title does not match the generated title.",
    );
  }

  const compact = toCompactPuzzle(decoded);
  const compactResult = CompactPuzzleV2Schema.safeParse(compact);
  if (!compactResult.success) {
    throw new PuzzleValidationError("MALFORMED_COMPACT", "Compact puzzle failed schema validation.");
  }

  for (const index of compact.titleTokenIndexes) {
    if (index < 0 || index >= compact.stream.length) {
      throw new PuzzleValidationError(
        "INVALID_TITLE_INDEXES",
        `titleTokenIndexes contains out-of-bounds stream index ${index}.`,
      );
    }
    const kind = compact.stream[index]?.[0];
    if (kind !== 0) {
      throw new PuzzleValidationError(
        "INVALID_TITLE_INDEXES",
        `titleTokenIndexes ${index} does not point to a word token.`,
      );
    }
  }

  const playable = simulateTitleWin(decoded);
  if (!playable.won) {
    throw new PuzzleValidationError(
      "NOT_PLAYABLE",
      "Simulated title guesses did not reach WON.",
    );
  }
}
