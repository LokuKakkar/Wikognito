import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AddDossierCaseRequest,
  AdminDossierDetail,
  AdminDossierListResponse,
  CreateDossierRequest,
  DossierCasePuzzleResponse,
  DossierDetail,
  DossierListResponse,
  DossierSeedRequest,
  DossierSeedResponse,
  UpdateDossierRequest,
} from "@redactle/shared";
import {
  parseDossierSeedDefinition,
  processCorpus,
  seedDossier,
  type WikipediaPageFetcher,
} from "@redactle/article-ingestion";
import { toOfficialSummary, type GameRepository } from "../games/game.repository.js";
import type { PuzzleRepository } from "../puzzles/puzzle.repository.js";
import { AppError } from "../errors.js";
import { DossierRepository } from "./dossier.repository.js";

export class DossierService {
  constructor(
    private readonly dossiers: DossierRepository,
    private readonly puzzles: PuzzleRepository,
    private readonly games: GameRepository,
    private readonly prisma: PrismaClient,
    private readonly provider: WikipediaPageFetcher,
    private readonly generatorVersion: string,
    private readonly concurrency: number,
    private readonly delayMs: number,
  ) {}

  async listPublished(page: number, pageSize: number, q?: string): Promise<DossierListResponse> {
    const { rows, total } = await this.dossiers.listPublished(page, pageSize, q);
    return {
      items: rows.map((row) => this.dossiers.toListItem(row)),
      page,
      pageSize,
      total,
    };
  }

  async getPublished(
    slug: string,
    identity: { sessionId: string; userId: string | null },
  ): Promise<DossierDetail> {
    const row = await this.dossiers.findPublishedBySlug(slug);
    if (!row) {
      throw new AppError("DOSSIER_NOT_FOUND", "Dossier could not be found.", 404);
    }
    const puzzleIds = row.caseFiles.map((item) => item.puzzle.id);
    const solved = new Set(
      identity.userId
        ? await this.games.findOfficialWonPuzzleIdsForUser(identity.userId, puzzleIds)
        : await this.games.findOfficialWonPuzzleIdsForSession(identity.sessionId, puzzleIds),
    );
    const cases = row.caseFiles.map((item) => {
      const isSolved = solved.has(item.puzzle.id);
      return {
        id: item.id,
        position: item.position,
        title: isSolved ? item.puzzle.title : null,
        titleWordLengths: titleWordLengths(item.puzzle.title),
        puzzleId: item.puzzle.id,
        playState: isSolved ? ("SOLVED" as const) : ("UNSOLVED" as const),
      };
    });
    const solvedCount = cases.filter((item) => item.playState === "SOLVED").length;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      coverImage: row.coverImage,
      status: row.status,
      caseCount: cases.length,
      solvedCount,
      closed: cases.length > 0 && solvedCount === cases.length,
      cases,
    };
  }

  async getPublishedCase(
    slug: string,
    caseId: string,
    identity: { sessionId: string; userId: string | null },
  ): Promise<DossierCasePuzzleResponse> {
    const row = await this.dossiers.findPublishedCase(slug, caseId);
    if (!row) {
      throw new AppError("DOSSIER_CASE_NOT_FOUND", "Case file could not be found.", 404);
    }
    const summary = identity.userId
      ? await this.games.findOfficialForUserPuzzle(identity.userId, row.puzzleId)
      : await this.games.findOfficialForSessionPuzzle(identity.sessionId, row.puzzleId);
    return {
      ...this.puzzles.toPublicDto(row.puzzle),
      officialResult: summary ? toOfficialSummary(summary) : null,
    };
  }

  listAdmin(page: number, pageSize: number, q?: string): Promise<AdminDossierListResponse> {
    return this.dossiers.listAdmin(page, pageSize, q);
  }

  async getAdmin(id: string): Promise<AdminDossierDetail> {
    const row = await this.dossiers.findAdminById(id);
    if (!row) {
      throw new AppError("DOSSIER_NOT_FOUND", "Dossier could not be found.", 404);
    }
    return this.dossiers.toAdminDetail(row);
  }

  async create(input: CreateDossierRequest): Promise<AdminDossierDetail> {
    try {
      const created = await this.dossiers.create({
        slug: input.slug,
        title: input.title,
        description: input.description ?? "",
        coverImage: input.coverImage ?? null,
      });
      return this.getAdmin(created.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("DOSSIER_SLUG_TAKEN", "A dossier with this slug already exists.", 409);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateDossierRequest): Promise<AdminDossierDetail> {
    const existing = await this.dossiers.findAdminById(id);
    if (!existing) {
      throw new AppError("DOSSIER_NOT_FOUND", "Dossier could not be found.", 404);
    }
    await this.dossiers.update(id, {
      title: input.title,
      description: input.description,
      coverImage: input.coverImage,
      status: input.status,
    });
    return this.getAdmin(id);
  }

  async addCase(id: string, input: AddDossierCaseRequest): Promise<AdminDossierDetail> {
    const existing = await this.dossiers.findAdminById(id);
    if (!existing) {
      throw new AppError("DOSSIER_NOT_FOUND", "Dossier could not be found.", 404);
    }
    let puzzleId = input.puzzleId;
    if (!puzzleId && input.articleId) {
      const article =
        (await this.prisma.article.findUnique({ where: { id: input.articleId } })) ??
        (await this.prisma.article.findUnique({ where: { externalId: input.articleId } }));
      if (!article) {
        throw new AppError("ARTICLE_NOT_FOUND", "Article not found.", 404);
      }
      const puzzle = await this.dossiers.findActivePuzzleForArticle(article.id, this.generatorVersion);
      if (!puzzle) {
        throw new AppError("PUZZLE_NOT_FOUND", "No puzzle exists for this article.", 404);
      }
      puzzleId = puzzle.id;
    }
    if (!puzzleId) {
      throw new AppError("INVALID_REQUEST", "puzzleId or articleId is required.", 400);
    }
    const puzzle = await this.dossiers.findPuzzleById(puzzleId);
    if (!puzzle) {
      throw new AppError("PUZZLE_NOT_FOUND", "Puzzle not found.", 404);
    }
    try {
      await this.dossiers.addCase({
        dossierId: id,
        puzzleId,
        position: await this.dossiers.nextPosition(id),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("DOSSIER_CASE_EXISTS", "This puzzle is already in the dossier.", 409);
      }
      throw error;
    }
    return this.getAdmin(id);
  }

  async removeCase(id: string, caseId: string): Promise<AdminDossierDetail> {
    const existing = await this.dossiers.findCase(id, caseId);
    if (!existing) {
      throw new AppError("DOSSIER_CASE_NOT_FOUND", "Case file could not be found.", 404);
    }
    await this.dossiers.deleteCase(caseId);
    const remaining = await this.dossiers.listCases(id);
    await this.dossiers.remapPositions(
      id,
      remaining.map((row) => row.id),
    );
    return this.getAdmin(id);
  }

  async reorderCase(id: string, caseId: string, position: number): Promise<AdminDossierDetail> {
    const cases = await this.dossiers.listCases(id);
    const current = cases.find((row) => row.id === caseId);
    if (!current) {
      throw new AppError("DOSSIER_CASE_NOT_FOUND", "Case file could not be found.", 404);
    }
    const bounded = Math.min(Math.max(position, 1), cases.length);
    const ordered = cases.filter((row) => row.id !== caseId).map((row) => row.id);
    ordered.splice(bounded - 1, 0, caseId);
    await this.dossiers.remapPositions(id, ordered);
    return this.getAdmin(id);
  }

  processCorpus(urls: string[]) {
    return processCorpus(urls, {
      prisma: this.prisma,
      provider: this.provider,
      generatorVersion: this.generatorVersion,
      concurrency: this.concurrency,
      delayMs: this.delayMs,
    });
  }

  seed(input: DossierSeedRequest): Promise<DossierSeedResponse> {
    const definition = parseDossierSeedDefinition(input);
    return seedDossier(definition, {
      prisma: this.prisma,
      provider: this.provider,
      generatorVersion: this.generatorVersion,
      concurrency: this.concurrency,
      delayMs: this.delayMs,
    });
  }
}

export function titleWordLengths(title: string): number[] {
  const words = title.match(/[\p{L}\p{N}']+/gu) ?? [];
  if (words.length === 0) {
    return [Math.max(1, title.replace(/\s+/g, "").length)];
  }
  return words.map((word) => word.length);
}
