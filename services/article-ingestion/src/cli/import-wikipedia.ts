#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { WikipediaArticleProvider } from "@redactle/article-provider";
import { importWikipediaArticle } from "../import/import-wikipedia.js";
import { ImportError } from "../import/errors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../../.env") });

function parseArgs(argv: string[]): { url?: string; file?: string } {
  const urlIdx = argv.indexOf("--url");
  const fileIdx = argv.indexOf("--file");
  return {
    url: urlIdx >= 0 ? argv[urlIdx + 1] : undefined,
    file: fileIdx >= 0 ? argv[fileIdx + 1] : undefined,
  };
}

function readUrlFile(filePath: string): string[] {
  const contents = readFileSync(filePath, "utf8");
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: string }).code);
    if (["P1000", "P1001", "P1002", "P1003", "P1017"].includes(code)) {
      return true;
    }
  }
  return false;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set it.");
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.url && !args.file) {
    throw new Error(
      'Usage: pnpm articles:import:wikipedia --url "<wikipedia-url>" OR --file <path>',
    );
  }

  const urls = args.url ? [args.url] : readUrlFile(resolve(process.cwd(), args.file!));
  if (urls.length === 0) {
    throw new Error("No Wikipedia URLs to import.");
  }

  const delayMs = Number(process.env.WIKIPEDIA_REQUEST_DELAY_MS ?? 500);
  const prisma = new PrismaClient();
  const provider = new WikipediaArticleProvider({
    apiUrl: process.env.WIKIPEDIA_API_URL,
    userAgent: process.env.WIKIPEDIA_USER_AGENT,
    timeoutMs: Number(process.env.WIKIPEDIA_TIMEOUT_MS ?? 60_000),
    maxRetries: Number(process.env.WIKIPEDIA_MAX_RETRIES ?? 5),
  });

  let imported = 0;
  let alreadyExists = 0;
  let failed = 0;

  try {
    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i]!;
      try {
        const result = await importWikipediaArticle(url, { prisma, provider });
        if (result.status === "IMPORTED") {
          imported += 1;
          console.log(`IMPORTED\t${result.article.externalId}\t${result.article.title}`);
        } else {
          alreadyExists += 1;
          console.log(`ALREADY_EXISTS\t${result.article.externalId}\t${result.article.title}`);
        }
      } catch (error) {
        if (isDatabaseUnavailable(error)) {
          throw error;
        }
        failed += 1;
        const message =
          error instanceof ImportError || error instanceof Error ? error.message : String(error);
        console.error(`FAILED\t${url}\t${message}`);
      }

      if (i < urls.length - 1 && delayMs > 0) {
        await delay(delayMs);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("");
  console.log(`Imported:       ${imported}`);
  console.log(`Already exists: ${alreadyExists}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Total:          ${urls.length}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
