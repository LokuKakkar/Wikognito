import type { Article as PrismaArticle, PrismaClient } from "@prisma/client";
import type { ArticleListResponse } from "@redactle/shared";
import { toArticleSummary } from "@redactle/article-ingestion";

const ARTICLE_LIST_SELECT = {
  id: true,
  externalId: true,
  title: true,
  source: true,
  sourceUrl: true,
  revisionId: true,
  language: true,
  wordCount: true,
  createdAt: true,
} as const;

export class ArticleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(page: number, pageSize: number, q?: string): Promise<ArticleListResponse> {
    const skip = (page - 1) * pageSize;
    const query = q?.trim();
    const where = query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { id: { contains: query, mode: "insensitive" as const } },
            { externalId: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : undefined;
    const [rows, total] = await Promise.all([
      this.prisma.article.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        where,
        select: ARTICLE_LIST_SELECT,
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      items: rows.map((row) => toArticleSummary(row)),
      page,
      pageSize,
      total,
    };
  }

  /**
   * Lookup by primary key, then by externalId (e.g. wikipedia:en:Pet_door).
   * Returns server-only rawContent for on-the-fly puzzle generation.
   */
  async findForPlay(articleId: string): Promise<PrismaArticle | null> {
    const byId = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (byId) return byId;
    return this.prisma.article.findUnique({ where: { externalId: articleId } });
  }
}
