import { Prisma, type GameResult, type GameResultSource, type Puzzle } from "@prisma/client";
import {
  PublicPuzzleDtoSchema,
  SCORE_VERSION,
  emptyPuzzleStats,
  type CompleteGameRequest,
  type GameResultResponse,
  type OfficialResultSummary,
  type PuzzleStats,
} from "@redactle/shared";
import {
  calculateScoreV1,
  computeDifficultyV1,
  countHitGuesses,
  decodeClientPayload,
  guessAccuracy,
} from "@redactle/puzzle-engine";
import { toOfficialSummary, type GameRepository } from "./game.repository.js";
import { recomputePuzzleStats } from "./puzzle-stats.js";
import type { PuzzleRepository } from "../puzzles/puzzle.repository.js";
import type { SessionRepository } from "../sessions/session.repository.js";

function toResponse(row: GameResult, puzzleStats: PuzzleStats): GameResultResponse {
  return {
    id: row.id,
    puzzleId: row.puzzleId,
    attemptId: row.attemptId,
    attemptNumber: row.attemptNumber,
    isOfficial: row.isOfficial,
    source: row.source,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt.toISOString(),
    durationMs: row.durationMs,
    guessCount: row.guessCount,
    hitGuessCount: row.hitGuessCount,
    guessAccuracy: row.hitGuessCount == null ? null : guessAccuracy(row.hitGuessCount, row.guessCount),
    won: row.won,
    score: row.score,
    scoreVersion: row.scoreVersion,
    status: row.status as GameResultResponse["status"],
    puzzleStats,
  };
}

function uniqueTargetIncludes(error: Prisma.PrismaClientKnownRequestError, field: string): boolean {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes(field);
  }
  if (typeof target === "string") {
    return target.includes(field);
  }
  return false;
}

function resolveDifficulty(puzzle: Puzzle): number {
  if (puzzle.difficultyVersion === 1 && puzzle.difficultyValue > 0) {
    return puzzle.difficultyValue;
  }
  return computeDifficultyV1({
    uniqueGuessableWordCount: puzzle.uniqueGuessableWordCount,
    guessableWordCount: puzzle.guessableWordCount,
    titleTokenCount: puzzle.titleTokenCount,
  }).difficultyValue;
}

function computeHitGuessCount(puzzle: Puzzle, guesses: string[]): number {
  try {
    const dto = PublicPuzzleDtoSchema.parse(puzzle.clientPuzzleData);
    const clientPuzzle = decodeClientPayload(dto.payload);
    return countHitGuesses(clientPuzzle, guesses);
  } catch {
    return 0;
  }
}

export class GameService {
  constructor(
    private readonly games: GameRepository,
    private readonly puzzles: PuzzleRepository,
    private readonly sessions: SessionRepository,
  ) {}

  /**
   * Idempotent completion: same sessionId + attemptId returns the existing result.
   * Authenticated officialness is one result per User + Puzzle.
   * Anonymous officialness remains first completion per session + puzzle.
   * Source is server-set from today's DailyPuzzle (never trusted from the client).
   */
  async complete(
    sessionId: string,
    userId: string | null,
    payload: CompleteGameRequest,
  ): Promise<GameResultResponse> {
    const puzzle = await this.puzzles.findById(payload.puzzleId);
    if (!puzzle) {
      const error = new Error("Puzzle not found") as Error & { code: string; statusCode: number };
      error.code = "PUZZLE_NOT_FOUND";
      error.statusCode = 404;
      throw error;
    }

    const existing = await this.games.findBySessionAndAttempt(sessionId, payload.attemptId);
    if (existing) {
      return this.respond(existing, false);
    }

    const redis = await this.sessions.get(sessionId);
    const sameAttempt = Boolean(redis && redis.attemptId === payload.attemptId);
    const redisTerminal = Boolean(
      redis && sameAttempt && (redis.status === "WON" || redis.status === "GAVE_UP"),
    );
    const guesses = redis && redisTerminal ? redis.guesses : payload.guesses;
    const status: "WON" | "GAVE_UP" =
      redis && redisTerminal && (redis.status === "WON" || redis.status === "GAVE_UP")
        ? redis.status
        : payload.status;
    const startedAtMs = redis && sameAttempt ? redis.startedAt : payload.startedAt;
    const completedAtMs = Date.now();
    const source = await this.resolveSource(payload.puzzleId, completedAtMs);

    const priorCount = await this.games.countAttemptsForSessionPuzzle(sessionId, payload.puzzleId);
    const officialCount = userId
      ? await this.games.countOfficialForUserPuzzle(userId, payload.puzzleId)
      : await this.games.countOfficialForSessionPuzzle(sessionId, payload.puzzleId);
    const attemptNumber = priorCount + 1;
    const isOfficial = officialCount === 0;

    const startedAt = new Date(startedAtMs);
    const completedAt = new Date(completedAtMs);
    const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
    const won = status === "WON";
    const hitGuessCount = computeHitGuessCount(puzzle, guesses);
    const competitive = isOfficial && won;
    const scored = competitive
      ? calculateScoreV1({
          guessCount: guesses.length,
          durationMs,
          hitGuessCount,
          difficultyValue: resolveDifficulty(puzzle),
        })
      : { score: 0, scoreVersion: 0 };

    const input = {
      sessionId,
      puzzleId: payload.puzzleId,
      attemptId: payload.attemptId,
      attemptNumber,
      isOfficial,
      source,
      userId,
      startedAt,
      completedAt,
      durationMs,
      guessCount: guesses.length,
      hitGuessCount,
      won,
      score: scored.score,
      scoreVersion: competitive ? SCORE_VERSION : scored.scoreVersion,
      status,
    };

    try {
      const created = await this.games.create(input);
      await this.persistRedis(sessionId, userId, payload.puzzleId, payload.attemptId, status, guesses, startedAtMs, completedAtMs);
      return this.respond(created, created.isOfficial && created.source === "DAILY");
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const sameAttemptRow = await this.games.findBySessionAndAttempt(sessionId, payload.attemptId);
        if (sameAttemptRow) {
          return this.respond(sameAttemptRow, false);
        }
        if (userId && uniqueTargetIncludes(error, "userId")) {
          const replay = await this.games.create({
            ...input,
            isOfficial: false,
            score: 0,
            scoreVersion: 0,
          });
          await this.persistRedis(sessionId, userId, payload.puzzleId, payload.attemptId, status, guesses, startedAtMs, completedAtMs);
          return this.respond(replay, false);
        }
      }
      throw error;
    }
  }

  async getPuzzleStats(puzzleId: string): Promise<PuzzleStats> {
    return (await this.games.findPuzzleStats(puzzleId)) ?? emptyPuzzleStats(puzzleId);
  }

  async getOfficialSummary(
    sessionId: string,
    userId: string | null,
    puzzleId: string,
  ): Promise<OfficialResultSummary | null> {
    const row = userId
      ? await this.games.findOfficialForUserPuzzle(userId, puzzleId)
      : await this.games.findOfficialForSessionPuzzle(sessionId, puzzleId);
    return row ? toOfficialSummary(row) : null;
  }

  async getHistory(userId: string, page: number, pageSize: number) {
    return this.games.listOfficialHistoryForUser(userId, page, pageSize);
  }

  private async respond(row: GameResult, recompute: boolean): Promise<GameResultResponse> {
    if (recompute) {
      const rows = await this.games.listOfficialDailyForPuzzle(row.puzzleId);
      await this.games.upsertPuzzleStats(recomputePuzzleStats(row.puzzleId, rows));
    }
    const puzzleStats = (await this.games.findPuzzleStats(row.puzzleId)) ?? emptyPuzzleStats(row.puzzleId);
    return toResponse(row, puzzleStats);
  }

  private async resolveSource(puzzleId: string, completedAtMs: number): Promise<GameResultSource> {
    const today = await this.puzzles.findPublishedForDate(new Date(completedAtMs));
    return today?.id === puzzleId ? "DAILY" : "ARCHIVE";
  }

  private async persistRedis(
    sessionId: string,
    userId: string | null,
    puzzleId: string,
    attemptId: string,
    status: "WON" | "GAVE_UP",
    guesses: string[],
    startedAt: number,
    completedAt: number,
  ): Promise<void> {
    const existing = await this.sessions.get(sessionId);
    await this.sessions.set(sessionId, {
      puzzleId,
      attemptId,
      userId: userId ?? existing?.userId ?? null,
      status,
      guesses,
      startedAt,
      completedAt,
      updatedAt: Date.now(),
    });
  }
}
