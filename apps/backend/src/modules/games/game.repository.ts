import type { GameResult, GameResultSource, Prisma, PrismaClient } from "@prisma/client";
import {
  SCORE_VERSION,
  type HistoryItem,
  type HistoryResponse,
  type OfficialResultSummary,
  type PuzzleStats,
} from "@redactle/shared";
import { guessAccuracy } from "@redactle/puzzle-engine";
import type { OfficialDailyRow } from "./puzzle-stats.js";

export interface CreateGameResultInput {
  sessionId: string;
  puzzleId: string;
  attemptId: string;
  attemptNumber: number;
  isOfficial: boolean;
  source: GameResultSource;
  userId?: string | null;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  guessCount: number;
  hitGuessCount: number | null;
  won: boolean;
  score: number;
  scoreVersion: number;
  status: string;
}

export function toOfficialSummary(row: GameResult): OfficialResultSummary {
  return {
    status: row.status === "GAVE_UP" ? "GAVE_UP" : "WON",
    guessCount: row.guessCount,
    durationMs: row.durationMs,
    hitGuessCount: row.hitGuessCount,
    guessAccuracy: guessAccuracy(row.hitGuessCount ?? 0, row.guessCount),
    score: row.score,
    scoreVersion: row.scoreVersion,
    isOfficial: true,
    source: row.source,
    completedAt: row.completedAt.toISOString(),
  };
}

export class GameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySessionAndAttempt(sessionId: string, attemptId: string): Promise<GameResult | null> {
    return this.prisma.gameResult.findUnique({
      where: {
        sessionId_attemptId: { sessionId, attemptId },
      },
    });
  }

  async countOfficialForSessionPuzzle(sessionId: string, puzzleId: string): Promise<number> {
    return this.prisma.gameResult.count({
      where: { sessionId, puzzleId, isOfficial: true },
    });
  }

  async countOfficialForUserPuzzle(userId: string, puzzleId: string): Promise<number> {
    return this.prisma.gameResult.count({
      where: { userId, puzzleId, isOfficial: true },
    });
  }

  async findOfficialForUserPuzzle(userId: string, puzzleId: string): Promise<GameResult | null> {
    return this.prisma.gameResult.findFirst({
      where: { userId, puzzleId, isOfficial: true },
    });
  }

  async findOfficialForSessionPuzzle(sessionId: string, puzzleId: string): Promise<GameResult | null> {
    return this.prisma.gameResult.findFirst({
      where: { sessionId, puzzleId, isOfficial: true },
    });
  }

  async findOfficialPuzzleIdsForUser(userId: string, puzzleIds: string[]): Promise<string[]> {
    if (puzzleIds.length === 0) return [];
    const rows = await this.prisma.gameResult.findMany({
      where: { userId, puzzleId: { in: puzzleIds }, isOfficial: true },
      select: { puzzleId: true },
    });
    return rows.map((row) => row.puzzleId);
  }

  async findOfficialPuzzleIdsForSession(sessionId: string, puzzleIds: string[]): Promise<string[]> {
    if (puzzleIds.length === 0) return [];
    const rows = await this.prisma.gameResult.findMany({
      where: { sessionId, puzzleId: { in: puzzleIds }, isOfficial: true },
      select: { puzzleId: true },
    });
    return rows.map((row) => row.puzzleId);
  }

  async findOfficialWonPuzzleIdsForUser(userId: string, puzzleIds: string[]): Promise<string[]> {
    if (puzzleIds.length === 0) return [];
    const rows = await this.prisma.gameResult.findMany({
      where: { userId, puzzleId: { in: puzzleIds }, isOfficial: true, won: true },
      select: { puzzleId: true },
    });
    return rows.map((row) => row.puzzleId);
  }

  async findOfficialWonPuzzleIdsForSession(sessionId: string, puzzleIds: string[]): Promise<string[]> {
    if (puzzleIds.length === 0) return [];
    const rows = await this.prisma.gameResult.findMany({
      where: { sessionId, puzzleId: { in: puzzleIds }, isOfficial: true, won: true },
      select: { puzzleId: true },
    });
    return rows.map((row) => row.puzzleId);
  }

  async countAttemptsForSessionPuzzle(sessionId: string, puzzleId: string): Promise<number> {
    return this.prisma.gameResult.count({
      where: { sessionId, puzzleId },
    });
  }

  async listOfficialUnclaimedBySession(sessionId: string): Promise<GameResult[]> {
    return this.prisma.gameResult.findMany({
      where: { sessionId, userId: null, isOfficial: true },
    });
  }

  async claimForUser(id: string, userId: string): Promise<GameResult> {
    return this.prisma.gameResult.update({
      where: { id },
      data: { userId },
    });
  }

  async discardOfficial(id: string): Promise<GameResult> {
    return this.prisma.gameResult.update({
      where: { id },
      data: { isOfficial: false },
    });
  }

  async create(input: CreateGameResultInput): Promise<GameResult> {
    return this.prisma.gameResult.create({
      data: {
        sessionId: input.sessionId,
        puzzleId: input.puzzleId,
        attemptId: input.attemptId,
        attemptNumber: input.attemptNumber,
        isOfficial: input.isOfficial,
        source: input.source,
        userId: input.userId ?? null,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        durationMs: input.durationMs,
        guessCount: input.guessCount,
        hitGuessCount: input.hitGuessCount,
        won: input.won,
        score: input.score,
        scoreVersion: input.scoreVersion,
        status: input.status,
      },
    });
  }

  async listOfficialBySession(sessionId: string): Promise<GameResult[]> {
    return this.prisma.gameResult.findMany({
      where: { sessionId, isOfficial: true },
      orderBy: { completedAt: "desc" },
    });
  }

  async listOfficialHistoryForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<HistoryResponse> {
    const skip = (page - 1) * pageSize;
    const where = { userId, isOfficial: true };
    const [rows, total] = await Promise.all([
      this.prisma.gameResult.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { completedAt: "desc" },
        include: {
          puzzle: {
            select: {
              puzzleNumber: true,
              dailyAssignment: { select: { date: true } },
            },
          },
        },
      }),
      this.prisma.gameResult.count({ where }),
    ]);

    const items: HistoryItem[] = rows.map((row) => ({
      puzzleId: row.puzzleId,
      puzzleNumber: row.puzzle.puzzleNumber,
      date: row.puzzle.dailyAssignment?.date
        ? row.puzzle.dailyAssignment.date.toISOString().slice(0, 10)
        : null,
      source: row.source,
      status: row.status === "GAVE_UP" ? "GAVE_UP" : "WON",
      won: row.won,
      guessCount: row.guessCount,
      durationMs: row.durationMs,
      hitGuessCount: row.hitGuessCount,
      guessAccuracy: row.hitGuessCount == null ? null : guessAccuracy(row.hitGuessCount, row.guessCount),
      score: row.scoreVersion === SCORE_VERSION ? row.score : null,
      scoreVersion: row.scoreVersion,
      completedAt: row.completedAt.toISOString(),
    }));

    return { items, page, pageSize, total };
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.gameResult.deleteMany({ where: { userId } });
  }

  async listOfficialDailyForPuzzle(puzzleId: string): Promise<OfficialDailyRow[]> {
    return this.prisma.gameResult.findMany({
      where: { puzzleId, isOfficial: true, source: "DAILY" },
      select: {
        guessCount: true,
        hitGuessCount: true,
        durationMs: true,
        won: true,
        status: true,
      },
    });
  }

  async findPuzzleStats(puzzleId: string): Promise<PuzzleStats | null> {
    const row = await this.prisma.puzzleStats.findUnique({ where: { puzzleId } });
    if (!row) return null;
    return toPuzzleStatsDto(row);
  }

  async upsertPuzzleStats(stats: PuzzleStats): Promise<PuzzleStats> {
    const row = await this.prisma.puzzleStats.upsert({
      where: { puzzleId: stats.puzzleId },
      create: {
        puzzleId: stats.puzzleId,
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        gamesGaveUp: stats.gamesGaveUp,
        medianGuessCount: stats.medianGuessCount,
        medianAccuracy: stats.medianAccuracy,
        medianDurationMs: stats.medianDurationMs,
        guessHistogram: stats.guessHistogram,
      },
      update: {
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        gamesGaveUp: stats.gamesGaveUp,
        medianGuessCount: stats.medianGuessCount,
        medianAccuracy: stats.medianAccuracy,
        medianDurationMs: stats.medianDurationMs,
        guessHistogram: stats.guessHistogram,
      },
    });
    return toPuzzleStatsDto(row);
  }
}

function toPuzzleStatsDto(row: {
  puzzleId: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesGaveUp: number;
  medianGuessCount: number | null;
  medianAccuracy: number | null;
  medianDurationMs: number | null;
  guessHistogram: Prisma.JsonValue;
}): PuzzleStats {
  const histogram =
    row.guessHistogram && typeof row.guessHistogram === "object" && !Array.isArray(row.guessHistogram)
      ? (row.guessHistogram as Record<string, number>)
      : {};
  return {
    puzzleId: row.puzzleId,
    gamesPlayed: row.gamesPlayed,
    gamesWon: row.gamesWon,
    gamesGaveUp: row.gamesGaveUp,
    medianGuessCount: row.medianGuessCount,
    medianAccuracy: row.medianAccuracy,
    medianDurationMs: row.medianDurationMs,
    guessHistogram: histogram,
  };
}
