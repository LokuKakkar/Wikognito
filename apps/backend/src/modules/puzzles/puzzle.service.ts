import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import type {
  ArchiveListResponse,
  GeneratePuzzleResponse,
  PublicPuzzleDto,
  PublishTodayResponse,
  PuzzleListResponse,
  PuzzlePoolStats,
  ValidatePuzzlesResponse,
} from "@redactle/shared";
import type { GameRepository } from "../games/game.repository.js";
import {
  createRedisTodayCache,
  generatePuzzleFromStoredArticle,
  publishDailyPuzzle,
  validateStoredPuzzles,
} from "@redactle/article-ingestion";
import type { PuzzleRepository } from "./puzzle.repository.js";
import { AppError } from "../errors.js";

export class PuzzleService {
  constructor(
    private readonly puzzles: PuzzleRepository,
    private readonly prisma: PrismaClient,
    private readonly redis: Redis | null,
    private readonly generatorVersion: string,
    private readonly games: GameRepository,
  ) {}

  async getToday(): Promise<PublicPuzzleDto> {
    const puzzle = await this.puzzles.getTodayPublicPuzzle();
    if (!puzzle) {
      throw new AppError("PUZZLE_NOT_FOUND", "Today's puzzle could not be found.", 404);
    }
    return puzzle;
  }

  async listArchive(
    page: number,
    pageSize: number,
    identity: { sessionId: string; userId: string | null },
  ): Promise<ArchiveListResponse> {
    const list = await this.puzzles.listArchive(page, pageSize);
    const ids = list.items.map((item) => item.puzzleId);
    const played = new Set(
      identity.userId
        ? await this.games.findOfficialPuzzleIdsForUser(identity.userId, ids)
        : await this.games.findOfficialPuzzleIdsForSession(identity.sessionId, ids),
    );
    return {
      ...list,
      items: list.items.map((item) => ({
        ...item,
        playState: played.has(item.puzzleId) ? "COMPLETED" : "UNPLAYED",
      })),
    };
  }

  async getArchivePuzzle(puzzleId: string): Promise<PublicPuzzleDto> {
    const assignment = await this.puzzles.findDailyAssignment(puzzleId);
    if (!assignment || assignment.puzzle.status !== "PUBLISHED") {
      throw new AppError("PUZZLE_NOT_FOUND", "Archive puzzle could not be found.", 404);
    }
    return this.puzzles.toPublicDto(assignment.puzzle);
  }

  list(page: number, pageSize: number, q?: string): Promise<PuzzleListResponse> {
    return this.puzzles.list(page, pageSize, q);
  }

  generate(articleId: string, force = false): Promise<GeneratePuzzleResponse> {
    return generatePuzzleFromStoredArticle({
      prisma: this.prisma,
      articleId,
      generatorVersion: this.generatorVersion,
      force,
    });
  }

  async validateAll(): Promise<ValidatePuzzlesResponse> {
    const items = await validateStoredPuzzles({ prisma: this.prisma });
    return {
      items,
      failed: items.filter((item) => !item.ok).length,
    };
  }

  async publishToday(puzzleId?: string): Promise<PublishTodayResponse> {
    try {
      return await publishDailyPuzzle({
        prisma: this.prisma,
        puzzleId,
        cache: createRedisTodayCache(this.redis),
      });
    } catch (error) {
      throw new AppError(
        "PUBLISH_FAILED",
        error instanceof Error ? error.message : "Could not publish today's puzzle.",
        400,
      );
    }
  }

  async poolStats(warningThreshold: number): Promise<PuzzlePoolStats> {
    const [usedInDaily, dossierLinked, unusedReady] = await Promise.all([
      this.prisma.dailyPuzzle.count(),
      this.prisma.dossierCaseFile.findMany({
        distinct: ["puzzleId"],
        select: { puzzleId: true },
      }),
      this.prisma.puzzle.findMany({
        where: {
          status: "READY",
          dailyAssignment: { is: null },
          article: { puzzles: { none: { status: "PUBLISHED" } } },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, createdAt: true },
      }),
    ]);
    const oldestReady = unusedReady[0] ?? null;
    const newestReady = unusedReady[unusedReady.length - 1] ?? null;
    return {
      readyUnused: unusedReady.length,
      usedInDaily,
      dossierLinked: dossierLinked.length,
      oldestReady: oldestReady
        ? { id: oldestReady.id, title: oldestReady.title, createdAt: oldestReady.createdAt.toISOString() }
        : null,
      newestReady: newestReady
        ? { id: newestReady.id, title: newestReady.title, createdAt: newestReady.createdAt.toISOString() }
        : null,
      warningThreshold,
      lowPool: unusedReady.length < warningThreshold,
    };
  }
}
