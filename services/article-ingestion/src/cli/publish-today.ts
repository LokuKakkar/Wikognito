#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { createRedisTodayCache, publishDailyPuzzle } from "../pipeline/persist.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../../.env") });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set it.");
  }

  const prisma = new PrismaClient();
  const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
    : null;

  try {
    if (redis) {
      await redis.connect();
    }
    const result = await publishDailyPuzzle({
      prisma,
      cache: createRedisTodayCache(redis),
    });

    if (result.status === "ALREADY_PUBLISHED") {
      console.log(`Already published: Puzzle #${result.puzzleNumber} (${result.puzzleId}) for ${result.date}`);
    } else {
      console.log(
        `Published Puzzle #${result.puzzleNumber} (${result.puzzleId}) for ${result.date}: ${result.title}`,
      );
    }
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
