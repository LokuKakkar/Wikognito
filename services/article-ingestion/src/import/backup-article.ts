import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import type { ImportedArticleRecord } from "./persist-article.js";
import { persistImportedArticle } from "./persist-article.js";

export const ARTICLE_BACKUP_VERSION = 1 as const;

export interface ArticleBackupFile {
  version: typeof ARTICLE_BACKUP_VERSION;
  article: ImportedArticleRecord;
}

export interface RestoreArticleBackupsResult {
  restored: number;
  alreadyExists: number;
  failed: number;
  total: number;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BACKUP_DIR = resolve(__dirname, "../../../../data/wikipedia-articles");

export function resolveArticleBackupDir(): string {
  const override = process.env.ARTICLE_BACKUP_DIR?.trim();
  if (override) {
    return resolve(override);
  }
  return DEFAULT_BACKUP_DIR;
}

export function articleBackupFilename(externalId: string): string {
  const safe = externalId.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "article"}.json`;
}

export function toImportedArticleRecord(row: ImportedArticleRecord): ImportedArticleRecord {
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

function isImportedArticleRecord(value: unknown): value is ImportedArticleRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const article = value as Record<string, unknown>;
  return (
    typeof article.id === "string" &&
    typeof article.externalId === "string" &&
    typeof article.title === "string" &&
    typeof article.source === "string" &&
    (article.sourceUrl === null || typeof article.sourceUrl === "string") &&
    (article.revisionId === null || typeof article.revisionId === "string") &&
    typeof article.language === "string" &&
    typeof article.rawContent === "string" &&
    (article.sourceWikitext === null || typeof article.sourceWikitext === "string") &&
    (article.contentHash === null || typeof article.contentHash === "string") &&
    typeof article.wordCount === "number"
  );
}

export function parseArticleBackupJson(raw: string): ImportedArticleRecord {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Backup file is not a JSON object.");
  }
  const file = parsed as { version?: unknown; article?: unknown };
  if (file.version !== ARTICLE_BACKUP_VERSION) {
    throw new Error(`Unsupported article backup version: ${String(file.version)}`);
  }
  if (!isImportedArticleRecord(file.article)) {
    throw new Error("Backup file is missing a valid article record.");
  }
  return toImportedArticleRecord(file.article);
}

export async function writeArticleBackup(
  article: ImportedArticleRecord,
  dir = resolveArticleBackupDir(),
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, articleBackupFilename(article.externalId));
  const payload: ArticleBackupFile = {
    version: ARTICLE_BACKUP_VERSION,
    article: toImportedArticleRecord(article),
  };
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

export async function listArticleBackupFiles(dir = resolveArticleBackupDir()): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return names
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => join(dir, name));
}

export async function readArticleBackupFile(filePath: string): Promise<ImportedArticleRecord> {
  return parseArticleBackupJson(await readFile(filePath, "utf8"));
}

export async function readArticleBackups(dir = resolveArticleBackupDir()): Promise<ImportedArticleRecord[]> {
  const files = await listArticleBackupFiles(dir);
  const articles: ImportedArticleRecord[] = [];
  for (const filePath of files) {
    articles.push(await readArticleBackupFile(filePath));
  }
  return articles;
}

export async function restoreArticleBackups(
  prisma: PrismaClient,
  dir = resolveArticleBackupDir(),
): Promise<RestoreArticleBackupsResult> {
  const files = await listArticleBackupFiles(dir);
  let restored = 0;
  let alreadyExists = 0;
  let failed = 0;

  for (const filePath of files) {
    try {
      const article = await readArticleBackupFile(filePath);
      const result = await persistImportedArticle(prisma, article);
      if (result.created) {
        restored += 1;
      } else {
        alreadyExists += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { restored, alreadyExists, failed, total: files.length };
}

export async function backupWikipediaArticles(
  prisma: PrismaClient,
  dir = resolveArticleBackupDir(),
): Promise<{ written: number; dir: string }> {
  const rows = await prisma.article.findMany({
    where: { source: "WIKIPEDIA" },
    orderBy: { externalId: "asc" },
  });

  for (const row of rows) {
    await writeArticleBackup(toImportedArticleRecord(row), dir);
  }

  return { written: rows.length, dir };
}
