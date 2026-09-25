import type { PrismaClient } from "@prisma/client";
import { normalizeWikipediaUrl, WikipediaUrlError } from "@redactle/article-provider";
import { ImportError } from "../import/errors.js";
import { importWikipediaArticle, type WikipediaPageFetcher } from "../import/import-wikipedia.js";
import { generatePuzzleFromStoredArticle, type GenerateFromArticleResult } from "../puzzles/generate.js";

export type CorpusStage =
  | "NORMALIZATION"
  | "WIKIPEDIA_FETCH"
  | "PERSIST_ARTICLE"
  | "GENERATE_PUZZLE"
  | "VALIDATE_PUZZLE"
  | "DOSSIER_LINK";

export interface CorpusItemResult {
  url: string;
  title?: string;
  articleId?: string;
  puzzleId?: string;
  articleStatus: "imported" | "already_exists" | "failed";
  puzzleStatus: "generated" | "already_exists" | "failed" | "skipped";
  stage?: CorpusStage;
  error?: string;
}

export interface CorpusSummary {
  total: number;
  imported: number;
  alreadyExisting: number;
  puzzlesGenerated: number;
  puzzlesAlreadyExisting: number;
  failed: number;
  items: CorpusItemResult[];
}

export interface ProcessCorpusOptions {
  prisma: PrismaClient;
  provider: WikipediaPageFetcher;
  generatorVersion: string;
  concurrency?: number;
  delayMs?: number;
  force?: boolean;
  importArticle?: typeof importWikipediaArticle;
  generatePuzzle?: typeof generatePuzzleFromStoredArticle;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyImportStage(error: unknown): CorpusStage {
  if (error instanceof WikipediaUrlError) {
    return "NORMALIZATION";
  }
  if (error instanceof ImportError) {
    if (error.code === "VALIDATION_ERROR") {
      return "PERSIST_ARTICLE";
    }
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return "NORMALIZATION";
    }
    return "WIKIPEDIA_FETCH";
  }
  return "WIKIPEDIA_FETCH";
}

function errorMessage(error: unknown): string {
  if (error instanceof ImportError || error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  delayMs: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));

  async function runWorker(): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) {
        return;
      }
      if (index > 0 && delayMs > 0) {
        await delay(delayMs);
      }
      results[index] = await worker(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function processOneUrl(
  url: string,
  options: ProcessCorpusOptions,
): Promise<CorpusItemResult> {
  const importArticle = options.importArticle ?? importWikipediaArticle;
  const generatePuzzle = options.generatePuzzle ?? generatePuzzleFromStoredArticle;

  try {
    normalizeWikipediaUrl(url);
  } catch (error) {
    return {
      url,
      articleStatus: "failed",
      puzzleStatus: "skipped",
      stage: "NORMALIZATION",
      error: errorMessage(error),
    };
  }

  let articleId: string | undefined;
  let title: string | undefined;
  let articleStatus: CorpusItemResult["articleStatus"];

  try {
    const imported = await importArticle(url, {
      prisma: options.prisma,
      provider: options.provider,
    });
    articleId = imported.article.id;
    title = imported.article.title;
    articleStatus = imported.status === "IMPORTED" ? "imported" : "already_exists";
  } catch (error) {
    return {
      url,
      articleStatus: "failed",
      puzzleStatus: "skipped",
      stage: classifyImportStage(error),
      error: errorMessage(error),
    };
  }

  let generated: GenerateFromArticleResult;
  try {
    generated = await generatePuzzle({
      prisma: options.prisma,
      articleId,
      generatorVersion: options.generatorVersion,
      force: options.force,
    });
  } catch (error) {
    return {
      url,
      title,
      articleId,
      articleStatus,
      puzzleStatus: "failed",
      stage: "GENERATE_PUZZLE",
      error: errorMessage(error),
    };
  }

  if (generated.status === "GENERATED") {
    return {
      url,
      title: generated.articleTitle || title,
      articleId: generated.articleId,
      puzzleId: generated.puzzleId,
      articleStatus,
      puzzleStatus: "generated",
    };
  }
  if (generated.status === "ALREADY_EXISTS") {
    return {
      url,
      title: generated.articleTitle || title,
      articleId: generated.articleId,
      puzzleId: generated.puzzleId,
      articleStatus,
      puzzleStatus: "already_exists",
    };
  }
  if (generated.status === "REJECTED") {
    return {
      url,
      title: generated.articleTitle || title,
      articleId: generated.articleId,
      articleStatus,
      puzzleStatus: "failed",
      stage: "VALIDATE_PUZZLE",
      error: generated.reason ?? "Puzzle validation failed.",
    };
  }
  return {
    url,
    title: generated.articleTitle || title,
    articleId: generated.articleId,
    articleStatus,
    puzzleStatus: "failed",
    stage: "GENERATE_PUZZLE",
    error: generated.reason ?? "Puzzle generation failed.",
  };
}

export async function processCorpus(
  urls: string[],
  options: ProcessCorpusOptions,
): Promise<CorpusSummary> {
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const delayMs = Math.max(0, options.delayMs ?? 500);
  const items = await runPool(urls, concurrency, delayMs, (url) => processOneUrl(url, options));

  return {
    total: urls.length,
    imported: items.filter((item) => item.articleStatus === "imported").length,
    alreadyExisting: items.filter((item) => item.articleStatus === "already_exists").length,
    puzzlesGenerated: items.filter((item) => item.puzzleStatus === "generated").length,
    puzzlesAlreadyExisting: items.filter((item) => item.puzzleStatus === "already_exists").length,
    failed: items.filter(
      (item) => item.articleStatus === "failed" || item.puzzleStatus === "failed",
    ).length,
    items,
  };
}

export function formatCorpusReport(summary: CorpusSummary): string {
  const lines = ["Wikognito Corpus Import", ""];
  summary.items.forEach((item, index) => {
    const heading = item.title || item.url;
    lines.push(`[${index + 1}/${summary.total}] ${heading}`);
    if (item.articleStatus === "imported") {
      lines.push("      Article: imported");
    } else if (item.articleStatus === "already_exists") {
      lines.push("      Article: already exists");
    } else {
      lines.push(`      Article: FAILED`);
    }
    if (item.puzzleStatus === "generated") {
      lines.push("      Puzzle: generated");
      lines.push("      Validation: PASS");
    } else if (item.puzzleStatus === "already_exists") {
      lines.push("      Puzzle: already exists");
    } else if (item.puzzleStatus === "failed") {
      lines.push("      Puzzle: FAILED");
      if (item.error) {
        lines.push(`      Reason: ${item.error}`);
      }
    }
    if (item.articleStatus === "failed" && item.error) {
      lines.push(`      Stage: ${item.stage ?? "UNKNOWN"}`);
      lines.push(`      Reason: ${item.error}`);
    }
    lines.push("");
  });
  lines.push("--------------------------------");
  lines.push(`Imported: ${summary.imported}`);
  lines.push(`Existing: ${summary.alreadyExisting}`);
  lines.push(`Puzzles generated: ${summary.puzzlesGenerated}`);
  lines.push(`Puzzles existing: ${summary.puzzlesAlreadyExisting}`);
  lines.push(`Failures: ${summary.failed}`);
  return lines.join("\n");
}
