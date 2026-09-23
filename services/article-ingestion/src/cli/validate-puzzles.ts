#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { validateStoredPuzzles } from "../puzzles/generate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../../.env") });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set it.");
  }

  const prisma = new PrismaClient();
  try {
    const results = await validateStoredPuzzles({ prisma });
    let failed = 0;
    for (const result of results) {
      if (result.ok) {
        console.log(`OK\t${result.puzzleId}\t${result.title}\t${result.status}`);
      } else {
        failed += 1;
        console.log(
          `FAIL\t${result.puzzleId}\t${result.title}\t${result.status}\t${result.reason ?? ""}`,
        );
      }
    }

    console.log("");
    console.log(`Validated: ${results.length}`);
    console.log(`Failed:    ${failed}`);
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
