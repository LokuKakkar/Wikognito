import type { PrismaClient, Puzzle } from "@prisma/client";
import type { Redis } from "ioredis";
import {
  REDIS_PUZZLE_TODAY_KEY,
  PublicPuzzleDtoSchema,
  type PublicPuzzleDto,
  type PuzzleListResponse,
  type PuzzleSummary,
} from "@redactle/shared";

export class PuzzleRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis | null,
    private readonly cacheTtlSeconds: number,
  ) {}

  async findById(id: string): Promise<Puzzle | null> {
    return this.prisma.puzzle.findUnique({ where: { id } });
  }

  async findPublishedForDate(date: Date): Promise<Puzzle | null> {
    const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const assignment = await this.prisma.dailyPuzzle.findUnique({
      where: { date: dateOnly },
      include: { puzzle: true },
    });
    if (!assignment || assignment.puzzle.status !== "PUBLISHED") {
      return null;
    }
    return assignment.puzzle;
  }

  async getTodayPublicPuzzle(date: Date = new Date()): Promise<PublicPuzzleDto | null> {
    const dateKey = date.toISOString().slice(0, 10);
    const cacheKey = `${REDIS_PUZZLE_TODAY_KEY}:${dateKey}`;

    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const parsed = PublicPuzzleDtoSchema.safeParse(JSON.parse(cached));
          if (parsed.success) return parsed.data;
        }
      } catch {
        // Cache is optional — fall through to PostgreSQL.
      }
    }

    const puzzle = await this.findPublishedForDate(date);
    if (!puzzle) return null;

    const publicDto = PublicPuzzleDtoSchema.parse(puzzle.clientPuzzleData);

    if (this.redis) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(publicDto), "EX", this.cacheTtlSeconds);
      } catch {
        // Ignore cache write failures.
      }
    }

    return publicDto;
  }

  async list(page: number, pageSize: number): Promise<PuzzleListResponse> {
    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.puzzle.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.puzzle.count(),
    ]);

    return {
      items: rows.map(toPuzzleSummary),
      page,
      pageSize,
      total,
    };
  }

  utcDateOnly(date: Date = new Date()): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  async listArchive(page: number, pageSize: number, now: Date = new Date()) {
    const today = this.utcDateOnly(now);
    const skip = (page - 1) * pageSize;
    const where = { date: { lt: today } };
    const [rows, total] = await Promise.all([
      this.prisma.dailyPuzzle.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { date: "desc" },
        include: { puzzle: { select: { puzzleNumber: true } } },
      }),
      this.prisma.dailyPuzzle.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        puzzleId: row.puzzleId,
        puzzleNumber: row.puzzle.puzzleNumber,
        date: row.date.toISOString().slice(0, 10),
      })),
      page,
      pageSize,
      total,
    };
  }

  async findDailyAssignment(puzzleId: string) {
    return this.prisma.dailyPuzzle.findUnique({
      where: { puzzleId },
      include: { puzzle: true },
    });
  }

  toPublicDto(puzzle: Puzzle): PublicPuzzleDto {
    return PublicPuzzleDtoSchema.parse(puzzle.clientPuzzleData);
  }
}

function toPuzzleSummary(row: Puzzle): PuzzleSummary {
  return {
    id: row.id,
    articleId: row.articleId,
    title: row.title,
    status: row.status,
    generatorVersion: row.generatorVersion,
    puzzleNumber: row.puzzleNumber,
    scheduledDate: row.scheduledDate ? row.scheduledDate.toISOString().slice(0, 10) : null,
    wordCount: row.wordCount,
    guessableWordCount: row.guessableWordCount,
    uniqueGuessableWordCount: row.uniqueGuessableWordCount,
    titleTokenCount: row.titleTokenCount,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}
