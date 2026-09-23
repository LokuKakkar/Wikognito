import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  articleBackupFilename,
  parseArticleBackupJson,
  readArticleBackups,
  restoreArticleBackups,
  writeArticleBackup,
} from "./backup-article.js";
import type { ImportedArticleRecord } from "./persist-article.js";

const SAMPLE: ImportedArticleRecord = {
  id: "article-pet-door",
  externalId: "wikipedia:en:Pet_door",
  title: "Pet door",
  source: "WIKIPEDIA",
  sourceUrl: "https://en.wikipedia.org/wiki/Pet_door",
  revisionId: "123",
  language: "en",
  rawContent: "A pet door is a small opening.",
  sourceWikitext: "A '''pet door''' is a small opening.",
  contentHash: "abc",
  wordCount: 6,
};

function createPrisma(overrides?: {
  findUnique?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
}) {
  return {
    article: {
      findUnique: overrides?.findUnique ?? vi.fn(),
      create: overrides?.create ?? vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe("article backups", () => {
  let backupDir: string;

  beforeEach(async () => {
    backupDir = await mkdtemp(join(tmpdir(), "redactle-article-backup-"));
  });

  afterEach(async () => {
    await rm(backupDir, { recursive: true, force: true });
  });

  it("derives a filesystem-safe filename from externalId", () => {
    expect(articleBackupFilename("wikipedia:en:Pet_door")).toBe("wikipedia-en-Pet_door.json");
  });

  it("writes and reads a snapshot from a temp dir", async () => {
    const filePath = await writeArticleBackup(SAMPLE, backupDir);
    expect(filePath).toBe(join(backupDir, "wikipedia-en-Pet_door.json"));

    const parsed = parseArticleBackupJson(await readFile(filePath, "utf8"));
    expect(parsed).toEqual(SAMPLE);

    const articles = await readArticleBackups(backupDir);
    expect(articles).toEqual([SAMPLE]);
  });

  it("restores an article and is idempotent on externalId", async () => {
    await writeArticleBackup(SAMPLE, backupDir);

    const created = {
      ...SAMPLE,
      createdAt: new Date("2026-08-13T00:00:00.000Z"),
      updatedAt: new Date("2026-08-13T00:00:00.000Z"),
    };
    const create = vi
      .fn()
      .mockResolvedValueOnce(created)
      .mockRejectedValueOnce({ code: "P2002" });
    const findUnique = vi.fn().mockResolvedValue(created);
    const prisma = createPrisma({ create, findUnique });

    const first = await restoreArticleBackups(prisma, backupDir);
    expect(first).toEqual({ restored: 1, alreadyExists: 0, failed: 0, total: 1 });

    const second = await restoreArticleBackups(prisma, backupDir);
    expect(second).toEqual({ restored: 0, alreadyExists: 1, failed: 0, total: 1 });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("counts invalid backup files as failed without writing to the database", async () => {
    await writeFile(join(backupDir, "broken.json"), "{ not valid backup }\n", "utf8");
    const create = vi.fn();
    const prisma = createPrisma({ create });

    const result = await restoreArticleBackups(prisma, backupDir);
    expect(result).toEqual({ restored: 0, alreadyExists: 0, failed: 1, total: 1 });
    expect(create).not.toHaveBeenCalled();
  });
});
