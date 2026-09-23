#!/usr/bin/env node
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { resolveArticleBackupDir, restoreArticleBackups } from "../import/backup-article.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../../.env") });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set it.");
  }

  const prisma = new PrismaClient();
  const dir = resolveArticleBackupDir();

  try {
    const result = await restoreArticleBackups(prisma, dir);
    console.log(`Restore directory: ${dir}`);
    console.log(`Restored:       ${result.restored}`);
    console.log(`Already exists: ${result.alreadyExists}`);
    console.log(`Failed:         ${result.failed}`);
    console.log(`Total:          ${result.total}`);
    if (result.failed > 0) {
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
