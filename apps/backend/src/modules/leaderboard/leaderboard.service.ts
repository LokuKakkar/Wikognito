import type { PrismaClient } from "@prisma/client";
import { SCORE_VERSION, type LeaderboardTodayResponse } from "@redactle/shared";
import type { PuzzleRepository } from "../puzzles/puzzle.repository.js";
import { AppError } from "../errors.js";

export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly puzzles: PuzzleRepository,
  ) {}

  async today(
    page: number,
    pageSize: number,
    userId: string | null,
    now: Date = new Date(),
  ): Promise<LeaderboardTodayResponse> {
    const puzzle = await this.puzzles.findPublishedForDate(now);
    if (!puzzle) {
      throw new AppError("PUZZLE_NOT_FOUND", "Today's puzzle could not be found.", 404);
    }

    const where = {
      puzzleId: puzzle.id,
      source: "DAILY" as const,
      isOfficial: true,
      won: true,
      scoreVersion: SCORE_VERSION,
      userId: { not: null },
    };

    const [total, rows] = await Promise.all([
      this.prisma.gameResult.count({ where }),
      this.prisma.gameResult.findMany({
        where,
        orderBy: [{ score: "desc" }, { completedAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: { displayName: true, avatarUrl: true },
          },
        },
      }),
    ]);

    let played = false;
    let me: LeaderboardTodayResponse["me"] = null;
    if (userId) {
      const mine = await this.prisma.gameResult.findFirst({
        where: { ...where, userId },
      });
      if (mine) {
        played = true;
        const better = await this.prisma.gameResult.count({
          where: {
            ...where,
            OR: [
              { score: { gt: mine.score } },
              { AND: [{ score: mine.score }, { completedAt: { lt: mine.completedAt } }] },
            ],
          },
        });
        me = { rank: better + 1, score: mine.score };
      } else {
        const anyOfficial = await this.prisma.gameResult.findFirst({
          where: { puzzleId: puzzle.id, userId, isOfficial: true, source: "DAILY" },
          select: { id: true },
        });
        played = Boolean(anyOfficial);
      }
    }

    const startRank = (page - 1) * pageSize;
    return {
      puzzleNumber: puzzle.puzzleNumber,
      date: puzzle.scheduledDate ? puzzle.scheduledDate.toISOString().slice(0, 10) : now.toISOString().slice(0, 10),
      page,
      pageSize,
      total,
      entries: rows.map((row, index) => ({
        rank: startRank + index + 1,
        displayName: row.user?.displayName?.trim() || "Player",
        avatarUrl: row.user?.avatarUrl ?? null,
        score: row.score,
        isCurrentUser: row.userId === userId,
      })),
      authenticated: Boolean(userId),
      played,
      me,
    };
  }
}
