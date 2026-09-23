import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { importWikipediaArticle } from "./import-wikipedia.js";
import { ImportError } from "./errors.js";
import { articleBackupFilename, parseArticleBackupJson } from "./backup-article.js";

const EXISTING = {
  id: "article-existing",
  externalId: "wikipedia:en:Pet_door",
  title: "Pet door",
  source: "WIKIPEDIA",
  sourceUrl: "https://en.wikipedia.org/wiki/Pet_door",
  revisionId: "1",
  language: "en",
  rawContent: "A pet door is a small opening.",
  sourceWikitext: null,
  contentHash: null,
  wordCount: 6,
  createdAt: new Date("2026-08-13T00:00:00.000Z"),
  updatedAt: new Date("2026-08-13T00:00:00.000Z"),
};

function createPrisma(overrides?: { findUnique?: ReturnType<typeof vi.fn>; create?: ReturnType<typeof vi.fn> }) {
  return {
    article: {
      findUnique: overrides?.findUnique ?? vi.fn(),
      create: overrides?.create ?? vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe("importWikipediaArticle", () => {
  let backupDir: string;
  const previousBackupDir = process.env.ARTICLE_BACKUP_DIR;

  beforeEach(async () => {
    backupDir = await mkdtemp(join(tmpdir(), "redactle-article-backup-"));
    process.env.ARTICLE_BACKUP_DIR = backupDir;
  });

  afterEach(async () => {
    if (previousBackupDir === undefined) {
      delete process.env.ARTICLE_BACKUP_DIR;
    } else {
      process.env.ARTICLE_BACKUP_DIR = previousBackupDir;
    }
    await rm(backupDir, { recursive: true, force: true });
  });

  it("imports a new article after fetching Wikipedia", async () => {
    const create = vi.fn(async ({ data }: { data: typeof EXISTING }) => ({
      ...data,
      createdAt: new Date("2026-08-13T00:00:00.000Z"),
      updatedAt: new Date("2026-08-13T00:00:00.000Z"),
    }));
    const prisma = createPrisma({
      findUnique: vi.fn(async () => null),
      create,
    });
    const fetchPage = vi.fn(async () => ({
      title: "Pet door",
      language: "en",
      revisionId: "123456789",
      canonicalUrl: "https://en.wikipedia.org/wiki/Pet_door",
      wikitext: "A '''pet door''' is a small opening that allows pets to enter.",
    }));

    const result = await importWikipediaArticle("https://en.wikipedia.org/wiki/Pet_door", {
      prisma,
      provider: { fetchPage },
    });

    expect(result.status).toBe("IMPORTED");
    expect(result.article.externalId).toBe("wikipedia:en:Pet_door");
    expect(result.article.title).toBe("Pet door");
    expect(fetchPage).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    const saved = create.mock.calls[0]?.[0]?.data as unknown as {
      rawContent: string;
      sourceWikitext: string;
    };
    expect(saved.rawContent.toLowerCase()).toContain("pet door");
    expect(saved.sourceWikitext).toContain("pet door");
  });

  it("writes a snapshot file on IMPORTED", async () => {
    const create = vi.fn(async ({ data }: { data: typeof EXISTING }) => ({
      ...data,
      createdAt: new Date("2026-08-13T00:00:00.000Z"),
      updatedAt: new Date("2026-08-13T00:00:00.000Z"),
    }));
    const prisma = createPrisma({
      findUnique: vi.fn(async () => null),
      create,
    });
    const fetchPage = vi.fn(async () => ({
      title: "Pet door",
      language: "en",
      revisionId: "123456789",
      canonicalUrl: "https://en.wikipedia.org/wiki/Pet_door",
      wikitext: "A '''pet door''' is a small opening that allows pets to enter.",
    }));

    await importWikipediaArticle("https://en.wikipedia.org/wiki/Pet_door", {
      prisma,
      provider: { fetchPage },
    });

    const fileName = articleBackupFilename("wikipedia:en:Pet_door");
    const snapshot = parseArticleBackupJson(await readFile(join(backupDir, fileName), "utf8"));
    expect(snapshot.externalId).toBe("wikipedia:en:Pet_door");
    expect(snapshot.title).toBe("Pet door");
    expect(snapshot.source).toBe("WIKIPEDIA");
    expect(snapshot.sourceWikitext).toContain("pet door");
    expect(snapshot.rawContent.toLowerCase()).toContain("pet door");
  });

  it("returns ALREADY_EXISTS without calling Wikipedia", async () => {
    const findUnique = vi.fn(async () => EXISTING);
    const create = vi.fn();
    const fetchPage = vi.fn();
    const prisma = createPrisma({ findUnique, create });

    const result = await importWikipediaArticle(
      "https://en.wikipedia.org/w/index.php?title=Pet_door&action=raw",
      { prisma, provider: { fetchPage } },
    );

    expect(result.status).toBe("ALREADY_EXISTS");
    expect(result.article.id).toBe("article-existing");
    expect(fetchPage).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing snapshot on ALREADY_EXISTS", async () => {
    const fileName = articleBackupFilename("wikipedia:en:Pet_door");
    const sentinel = "do-not-overwrite\n";
    await writeFile(join(backupDir, fileName), sentinel, "utf8");

    const prisma = createPrisma({
      findUnique: vi.fn(async () => EXISTING),
      create: vi.fn(),
    });

    await importWikipediaArticle("https://en.wikipedia.org/wiki/Pet_door", {
      prisma,
      provider: { fetchPage: vi.fn() },
    });

    expect(await readFile(join(backupDir, fileName), "utf8")).toBe(sentinel);
    expect(await readdir(backupDir)).toEqual([fileName]);
  });

  it("rejects invalid URLs before fetching", async () => {
    const fetchPage = vi.fn();
    const prisma = createPrisma({
      findUnique: vi.fn(),
      create: vi.fn(),
    });

    await expect(
      importWikipediaArticle("https://google.com", { prisma, provider: { fetchPage } }),
    ).rejects.toBeInstanceOf(ImportError);
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
