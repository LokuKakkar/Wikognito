import { randomUUID } from "node:crypto";
import type { SessionSyncRequest, SessionState } from "@redactle/shared";
import type { SessionRepository } from "./session.repository.js";
import type { PuzzleRepository } from "../puzzles/puzzle.repository.js";

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly puzzles: PuzzleRepository,
  ) {}

  createSessionId(): string {
    return randomUUID();
  }

  async getCurrent(sessionId: string | undefined): Promise<SessionState | null> {
    if (!sessionId) return null;
    return this.sessions.get(sessionId);
  }

  async sync(sessionId: string, payload: SessionSyncRequest): Promise<SessionState> {
    const puzzle = await this.puzzles.findById(payload.puzzleId);
    if (!puzzle) {
      const error = new Error("Puzzle not found") as Error & { code: string; statusCode: number };
      error.code = "PUZZLE_NOT_FOUND";
      error.statusCode = 404;
      throw error;
    }

    const existing = await this.sessions.get(sessionId);
    const state: SessionState = {
      puzzleId: payload.puzzleId,
      attemptId: payload.attemptId,
      userId: existing?.userId ?? null,
      status: payload.status,
      guesses: payload.guesses,
      startedAt: payload.startedAt,
      completedAt: payload.completedAt ?? null,
      updatedAt: Date.now(),
    };

    await this.sessions.set(sessionId, state);
    return state;
  }
}
