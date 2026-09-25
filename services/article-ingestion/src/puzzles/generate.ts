import type { Article as PrismaArticle, PrismaClient } from "@prisma/client";
import type { Article } from "@redactle/shared";
import { runIngestionPipeline } from "../pipeline/pipeline.js";
import { persistReadyPuzzle, readyPuzzleId } from "../pipeline/persist.js";
import { PuzzleValidationError } from "../validator/validator.js";
import { validateStoredPuzzle, type ValidateStoredPuzzleResult } from "./validate-stored.js";

export { validateStoredPuzzle } from "./validate-stored.js";
export type { ValidateStoredPuzzleResult } from "./validate-stored.js";

export function toPipelineArticle(row: PrismaArticle): Article {
  return {
    id: row.id,
    externalId: row.externalId,
    title: row.title,
    source: row.source,
    sourceUrl: row.sourceUrl,
    revisionId: row.revisionId,
    language: row.language,
    rawContent: row.rawContent,
    sourceWikitext: row.sourceWikitext,
    contentHash: row.contentHash,
    wordCount: row.wordCount,
  };
}

export interface GenerateFromArticleResult {
  status: "GENERATED" | "ALREADY_EXISTS" | "REJECTED" | "FAILED";
  articleId: string;
  articleTitle: string;
  puzzleId?: string;
  reason?: string;
}

export async function generatePuzzleFromStoredArticle(options: {
  prisma: PrismaClient;
  articleId: string;
  generatorVersion: string;
  force?: boolean;
}): Promise<GenerateFromArticleResult> {
  const { prisma, generatorVersion, force = false } = options;
  const row =
    (await prisma.article.findUnique({ where: { id: options.articleId } })) ??
    (await prisma.article.findUnique({ where: { externalId: options.articleId } }));

  if (!row) {
    return {
      status: "FAILED",
      articleId: options.articleId,
      articleTitle: "",
      reason: "Article not found.",
    };
  }

  try {
    const result = runIngestionPipeline(toPipelineArticle(row), {
      puzzleId: readyPuzzleId(row.id, generatorVersion),
      puzzleNumber: 0,
      scheduledDate: "",
      generatorVersion,
    });
    const persisted = await persistReadyPuzzle(result, {
      prisma,
      generatorVersion,
      force,
    });
    return {
      status: persisted.status,
      articleId: persisted.articleId,
      articleTitle: row.title,
      puzzleId: persisted.puzzleId,
    };
  } catch (error) {
    if (error instanceof PuzzleValidationError) {
      return {
        status: "REJECTED",
        articleId: row.id,
        articleTitle: row.title,
        reason: `${error.reason}: ${error.message}`,
      };
    }
    return {
      status: "FAILED",
      articleId: row.id,
      articleTitle: row.title,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function generatePuzzlesForAllArticles(options: {
  prisma: PrismaClient;
  generatorVersion: string;
  force?: boolean;
}): Promise<GenerateFromArticleResult[]> {
  const articles = await options.prisma.article.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const results: GenerateFromArticleResult[] = [];
  for (const article of articles) {
    results.push(
      await generatePuzzleFromStoredArticle({
        prisma: options.prisma,
        articleId: article.id,
        generatorVersion: options.generatorVersion,
        force: options.force,
      }),
    );
  }
  return results;
}

export async function validateStoredPuzzles(options: {
  prisma: PrismaClient;
}): Promise<ValidateStoredPuzzleResult[]> {
  const puzzles = await options.prisma.puzzle.findMany({
    orderBy: { createdAt: "asc" },
  });
  return puzzles.map((puzzle) => validateStoredPuzzle(puzzle));
}
