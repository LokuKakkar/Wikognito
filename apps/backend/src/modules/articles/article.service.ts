import type { PrismaClient } from "@prisma/client";
import type { ArticleListResponse, ImportArticleResponse, PublicPuzzleDto } from "@redactle/shared";
import {
  importWikipediaArticle,
  runIngestionPipeline,
  toPipelineArticle,
  type WikipediaPageFetcher,
} from "@redactle/article-ingestion";
import { ArticleRepository } from "./article.repository.js";
import { AppError } from "../errors.js";

function utcDateString(date: Date = new Date()): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

export class ArticleService {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly prisma: PrismaClient,
    private readonly provider: WikipediaPageFetcher,
    private readonly generatorVersion: string,
  ) {}

  importFromUrl(url: string): Promise<ImportArticleResponse> {
    return importWikipediaArticle(url, {
      prisma: this.prisma,
      provider: this.provider,
    });
  }

  list(page: number, pageSize: number, q?: string): Promise<ArticleListResponse> {
    return this.repo.list(page, pageSize, q);
  }

  /**
   * Generate an opaque public puzzle from a stored article without persisting a Puzzle row.
   * Admin preview only — does not replace today's published puzzle or write GameResult FKs.
   */
  async getPlayPuzzle(articleId: string): Promise<PublicPuzzleDto> {
    const row = await this.repo.findForPlay(articleId);
    if (!row) {
      throw new AppError("ARTICLE_NOT_FOUND", "Article not found.", 404);
    }

    try {
      const result = runIngestionPipeline(toPipelineArticle(row), {
        puzzleId: `admin-play-${row.id}`,
        puzzleNumber: 0,
        scheduledDate: utcDateString(),
        generatorVersion: this.generatorVersion,
      });
      return result.generated.publicDto;
    } catch {
      throw new AppError(
        "PUZZLE_GENERATION_FAILED",
        "Could not generate a playable puzzle from this article.",
        400,
      );
    }
  }
}
