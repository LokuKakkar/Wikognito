import { z } from "zod";
import { GameStatusSchema } from "./game.js";

export const SessionStateSchema = z.object({
  puzzleId: z.string(),
  attemptId: z.string(),
  userId: z.string().nullable(),
  status: GameStatusSchema,
  guesses: z.array(z.string()),
  startedAt: z.number(),
  completedAt: z.number().nullable().optional(),
  updatedAt: z.number(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

export const SessionSyncRequestSchema = z.object({
  puzzleId: z.string(),
  attemptId: z.string(),
  status: GameStatusSchema,
  guesses: z.array(z.string()),
  startedAt: z.number(),
  completedAt: z.number().nullable().optional(),
});
export type SessionSyncRequest = z.infer<typeof SessionSyncRequestSchema>;
