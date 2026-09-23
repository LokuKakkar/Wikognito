import { z } from "zod";

export const TokenTypeSchema = z.enum(["word", "text", "punctuation", "whitespace"]);
export type TokenType = z.infer<typeof TokenTypeSchema>;

/** Internal decoded client model used by the game engine / renderer. */
export const ClientPuzzleTokenSchema = z.object({
  tokenId: z.string(),
  type: TokenTypeSchema,
  wordLength: z.number().int().positive().optional(),
  inTitle: z.boolean().optional(),
  redacted: z.boolean().optional(),
  /** Visible text for non-redacted tokens, or after local reveal. */
  displayValue: z.string().optional(),
  /**
   * Normalized match key for client-side guessing.
   * Present only after the opaque payload is decoded — never as a plain API field.
   */
  matchKey: z.string().optional(),
});
export type ClientPuzzleToken = z.infer<typeof ClientPuzzleTokenSchema>;

export const ClientPuzzleSchema = z.object({
  puzzleId: z.string(),
  puzzleNumber: z.number().int(),
  scheduledDate: z.string(),
  generatorVersion: z.string(),
  /** Token IDs that make up the article title (win when all are revealed). */
  titleTokenIds: z.array(z.string()),
  /** Authoritative article title text (never reconstructed from the stream). */
  title: z.string(),
  content: z.array(ClientPuzzleTokenSchema),
});
export type ClientPuzzle = z.infer<typeof ClientPuzzleSchema>;

/**
 * Public API DTO for GET /api/puzzles/today.
 * `payload` is opaque (compressed + encoded); not human-readable JSON.
 */
export const PublicPuzzleDtoSchema = z.object({
  id: z.string(),
  puzzleNumber: z.number().int(),
  scheduledDate: z.string(),
  generatorVersion: z.string(),
  payload: z.string().min(1),
});
export type PublicPuzzleDto = z.infer<typeof PublicPuzzleDtoSchema>;
