import type { PrismaClient } from "@prisma/client";
import type { ArticleSummary } from "@redactle/shared";

export interface ImportedArticleRecord {
  id: string;
  externalId: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  revisionId: string | null;
  language: string;
  rawContent: string;
  sourceWikitext: string | null;
  contentHash: string | null;
  wordCount: number;
}

export function toArticleSummary(article: {
  id: string;
  externalId: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  revisionId: string | null;
  language: string;
  wordCount: number;
  createdAt: Date;
}): ArticleSummary {
  return {
    id: article.id,
    externalId: article.externalId,
    title: article.title,
    source: article.source,
    sourceUrl: article.sourceUrl,
    revisionId: article.revisionId,
    language: article.language,
    wordCount: article.wordCount,
    createdAt: article.createdAt.toISOString(),
  };
}

export async function findArticleByExternalId(prisma: PrismaClient, externalId: string) {
  return prisma.article.findUnique({ where: { externalId } });
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002",
  );
}

export async function persistImportedArticle(
  prisma: PrismaClient,
  data: ImportedArticleRecord,
): Promise<{ created: boolean; article: ArticleSummary }> {
  try {
    const saved = await prisma.article.create({ data });
    return { created: true, article: toArticleSummary(saved) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await findArticleByExternalId(prisma, data.externalId);
      if (existing) {
        return { created: false, article: toArticleSummary(existing) };
      }
    }
    throw error;
  }
}
