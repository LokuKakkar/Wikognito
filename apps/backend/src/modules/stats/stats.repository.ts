import type { PrismaClient } from "@prisma/client";

export interface OfficialUserResult {
  won: boolean;
  status: string;
  guessCount: number;
  durationMs: number;
  hitGuessCount: number | null;
  completedAt: Date;
  dailyDate: Date | null;
  source: "DAILY" | "ARCHIVE";
  puzzleNumber: number;
}

export class StatsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Official daily results only — replays must not inflate stats. */
  async aggregateOfficialForSession(sessionId: string) {
    return this.prisma.gameResult.findMany({
      where: { sessionId, isOfficial: true },
    });
  }

  async aggregateOfficialForUser(userId: string): Promise<OfficialUserResult[]> {
    const rows = await this.prisma.gameResult.findMany({
      where: { userId, isOfficial: true },
      include: {
        puzzle: {
          select: {
            puzzleNumber: true,
            dailyAssignment: {
              select: { date: true },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      won: row.won,
      status: row.status,
      guessCount: row.guessCount,
      durationMs: row.durationMs,
      hitGuessCount: row.hitGuessCount,
      completedAt: row.completedAt,
      dailyDate: row.puzzle.dailyAssignment?.date ?? null,
      source: row.source,
      puzzleNumber: row.puzzle.puzzleNumber,
    }));
  }

  async earliestDailyDate(): Promise<Date | null> {
    const row = await this.prisma.dailyPuzzle.findFirst({
      orderBy: { date: "asc" },
      select: { date: true },
    });
    return row?.date ?? null;
  }
}
