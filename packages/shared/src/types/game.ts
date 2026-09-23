import { z } from "zod";

export const GameStatusSchema = z.enum(["IN_PROGRESS", "WON", "GAVE_UP"]);
export type GameStatus = z.infer<typeof GameStatusSchema>;

export const GameStateSchema = z.object({
  puzzleId: z.string(),
  attemptId: z.string(),
  guesses: z.array(z.string()),
  startedAt: z.number(),
  completedAt: z.number().nullable().optional(),
  status: GameStatusSchema,
});
export type GameState = z.infer<typeof GameStateSchema>;

export const GuessResultSchema = z.object({
  normalizedGuess: z.string(),
  hitCount: z.number().int().nonnegative(),
  matchedTokenIds: z.array(z.string()),
  isCorrect: z.boolean(),
  isDuplicate: z.boolean(),
  gameCompleted: z.boolean(),
  status: GameStatusSchema,
});
export type GuessResult = z.infer<typeof GuessResultSchema>;
