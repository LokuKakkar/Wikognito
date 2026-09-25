#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { WikipediaArticleProvider } from "@redactle/article-provider";
import { formatCorpusReport } from "../corpus/process-corpus.js";
import { parseDossierSeedDefinition, seedDossier } from "../corpus/seed-dossier.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../../.env") });

function parseArgs(argv: string[]): { file?: string } {
  const fileIdx = argv.indexOf("--file");
  return {
    file: fileIdx >= 0 ? argv[fileIdx + 1] : argv.find((arg) => !arg.startsWith("-")),
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set it.");
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    throw new Error("Usage: pnpm dossiers:seed -- --file <path>");
  }

  const raw = JSON.parse(readFileSync(resolve(process.cwd(), args.file), "utf8")) as unknown;
  const definition = parseDossierSeedDefinition(raw);
  const prisma = new PrismaClient();
  const provider = new WikipediaArticleProvider({
    apiUrl: process.env.WIKIPEDIA_API_URL,
    userAgent: process.env.WIKIPEDIA_USER_AGENT,
    timeoutMs: Number(process.env.WIKIPEDIA_TIMEOUT_MS ?? 60_000),
    maxRetries: Number(process.env.WIKIPEDIA_MAX_RETRIES ?? 5),
  });

  try {
    const result = await seedDossier(definition, {
      prisma,
      provider,
      generatorVersion: process.env.PUZZLE_GENERATOR_VERSION ?? "2.0.0",
      concurrency: Number(process.env.WIKIPEDIA_IMPORT_CONCURRENCY ?? 2),
      delayMs: Number(process.env.WIKIPEDIA_REQUEST_DELAY_MS ?? 500),
    });
    console.log(formatCorpusReport(result.corpus));
    console.log("");
    console.log(`Dossier: ${result.created ? "created" : "updated"} ${result.slug}`);
    console.log(`Cases added: ${result.casesAdded}`);
    console.log(`Cases existing: ${result.casesAlreadyExisting}`);
    if (result.failed.length > 0) {
      console.log(`Link/corpus failures: ${result.failed.length}`);
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
