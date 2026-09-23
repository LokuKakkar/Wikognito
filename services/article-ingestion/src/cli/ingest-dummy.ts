#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { createArticleProvider } from "@redactle/article-provider";
import { runIngestionPipeline } from "../pipeline/pipeline.js";
import {
  createRedisTodayCache,
  formatUtcDate,
  persistPipelineResult,
  readyPuzzleId,
  utcDateOnly,
} from "../pipeline/persist.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../../.env") });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set it.");
  }

  const generatorVersion = process.env.PUZZLE_GENERATOR_VERSION ?? "2.0.0";
  const prisma = new PrismaClient();
  const provider = createArticleProvider("LOCAL");
  const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
    : null;

  try {
    if (redis) {
      await redis.connect();
    }

    const articles = await provider.getArticles({ limit: 1 });
    const article = articles[0];
    if (!article) {
      throw new Error("LocalArticleProvider returned no articles");
    }

    const scheduledDate = utcDateOnly();
    const result = runIngestionPipeline(article, {
      puzzleId: readyPuzzleId(article.id, generatorVersion),
      puzzleNumber: 0,
      scheduledDate: formatUtcDate(scheduledDate),
      generatorVersion,
    });

    const persisted = await persistPipelineResult(result, {
      prisma,
      scheduledDate,
      puzzleNumber: 1,
      generatorVersion,
      cache: createRedisTodayCache(redis),
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          articleId: persisted.articleId,
          puzzleId: persisted.puzzleId,
          scheduledDate: formatUtcDate(scheduledDate),
          title: result.article.title,
          redactedWords: result.generated.clientPuzzle.content.filter(
            (t) => t.type === "word" && t.redacted,
          ).length,
        },
        null,
        2,
      ),
    );
  } finally {
    if (redis) {
      await redis.quit();
    }
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
