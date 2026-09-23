#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  generatePuzzleFromStoredArticle,
  generatePuzzlesForAllArticles,
  type GenerateFromArticleResult,
} from "../puzzles/generate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../../.env") });

function parseArgs(argv: string[]): { articleId?: string; all: boolean; force: boolean } {
  const articleIdx = argv.findIndex((arg) => arg === "--article-id" || arg === "--articleId");
  return {
    articleId: articleIdx >= 0 ? argv[articleIdx + 1] : undefined,
    all: argv.includes("--all"),
    force: argv.includes("--force"),
  };
}

function printResult(result: GenerateFromArticleResult): void {
  const puzzle = result.puzzleId ? `\t${result.puzzleId}` : "";
  const reason = result.reason ? `\t${result.reason}` : "";
  console.log(`${result.status}\t${result.articleId}\t${result.articleTitle}${puzzle}${reason}`);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set it.");
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.articleId && !args.all) {
    throw new Error("Usage: pnpm puzzles:generate -- --article-id <id> | --all [--force]");
  }

  const generatorVersion = process.env.PUZZLE_GENERATOR_VERSION ?? "2.0.0";
  const prisma = new PrismaClient();

  try {
    const results = args.all
      ? await generatePuzzlesForAllArticles({
          prisma,
          generatorVersion,
          force: args.force,
        })
      : [
          await generatePuzzleFromStoredArticle({
            prisma,
            articleId: args.articleId!,
            generatorVersion,
            force: args.force,
          }),
        ];

    for (const result of results) {
      printResult(result);
    }

    const generated = results.filter((result) => result.status === "GENERATED").length;
    const already = results.filter((result) => result.status === "ALREADY_EXISTS").length;
    const rejected = results.filter((result) => result.status === "REJECTED").length;
    const failed = results.filter((result) => result.status === "FAILED").length;

    console.log("");
    console.log(`Generated:       ${generated}`);
    console.log(`Already existed: ${already}`);
    console.log(`Rejected:        ${rejected}`);
    console.log(`Failed:          ${failed}`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
