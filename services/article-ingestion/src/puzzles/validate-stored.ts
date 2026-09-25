import {
  CompactPuzzleV2Schema,
  decodeClientPayload,
  simulateTitleWin,
  toCompactPuzzle,
} from "@redactle/puzzle-engine";
import { PublicPuzzleDtoSchema } from "@redactle/shared";
import { PuzzleValidationError } from "../validator/validator.js";

export interface ValidateStoredPuzzleResult {
  puzzleId: string;
  articleId: string;
  title: string;
  status: string;
  ok: boolean;
  reason?: string;
}

export function validateStoredPuzzle(puzzle: {
  id: string;
  articleId: string;
  title: string;
  status: string;
  clientPuzzleData: unknown;
}): ValidateStoredPuzzleResult {
  const base = {
    puzzleId: puzzle.id,
    articleId: puzzle.articleId,
    title: puzzle.title,
    status: puzzle.status,
  };
  try {
    const dto = PublicPuzzleDtoSchema.parse(puzzle.clientPuzzleData);
    const decoded = decodeClientPayload(dto.payload);
    const compact = toCompactPuzzle(decoded);
    const compactResult = CompactPuzzleV2Schema.safeParse(compact);
    if (!compactResult.success) {
      return { ...base, ok: false, reason: "MALFORMED_COMPACT" };
    }
    if (!simulateTitleWin(decoded).won) {
      return { ...base, ok: false, reason: "NOT_PLAYABLE" };
    }
    return { ...base, ok: true };
  } catch (error) {
    const reason =
      error instanceof PuzzleValidationError
        ? error.reason
        : error instanceof Error
          ? error.message
          : String(error);
    return { ...base, ok: false, reason };
  }
}
