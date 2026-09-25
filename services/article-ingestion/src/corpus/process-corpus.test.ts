import { describe, expect, it, vi } from "vitest";
import { ImportError } from "../import/errors.js";
import { processCorpus } from "./process-corpus.js";

const prisma = {} as never;
const provider = { fetchPage: vi.fn() };

describe("processCorpus", () => {
  it("imports missing articles and generates puzzles", async () => {
    const importArticle = vi.fn(async () => ({
      status: "IMPORTED" as const,
      article: { id: "a1", title: "Iron Man", externalId: "wikipedia:en:Iron_Man" },
    }));
    const generatePuzzle = vi.fn(async () => ({
      status: "GENERATED" as const,
      articleId: "a1",
      articleTitle: "Iron Man",
      puzzleId: "p1",
    }));

    const summary = await processCorpus(["https://en.wikipedia.org/wiki/Iron_Man"], {
      prisma,
      provider,
      generatorVersion: "2.0.0",
      concurrency: 1,
      delayMs: 0,
      importArticle: importArticle as never,
      generatePuzzle: generatePuzzle as never,
    });

    expect(summary.imported).toBe(1);
    expect(summary.puzzlesGenerated).toBe(1);
    expect(summary.failed).toBe(0);
    expect(importArticle).toHaveBeenCalledOnce();
  });

  it("skips Wikipedia when the article already exists and reuses a puzzle", async () => {
    const importArticle = vi.fn(async () => ({
      status: "ALREADY_EXISTS" as const,
      article: { id: "a1", title: "Iron Man", externalId: "wikipedia:en:Iron_Man" },
    }));
    const generatePuzzle = vi.fn(async () => ({
      status: "ALREADY_EXISTS" as const,
      articleId: "a1",
      articleTitle: "Iron Man",
      puzzleId: "p1",
    }));

    const summary = await processCorpus(
      ["https://en.wikipedia.org/wiki/Iron_Man", "https://en.wikipedia.org/wiki/Iron_Man"],
      {
        prisma,
        provider,
        generatorVersion: "2.0.0",
        concurrency: 1,
        delayMs: 0,
        importArticle: importArticle as never,
        generatePuzzle: generatePuzzle as never,
      },
    );

    expect(summary.alreadyExisting).toBe(2);
    expect(summary.puzzlesAlreadyExisting).toBe(2);
    expect(summary.failed).toBe(0);
  });

  it("continues after a failed article", async () => {
    const importArticle = vi
      .fn()
      .mockRejectedValueOnce(new ImportError("FETCH_FAILED", "Wikipedia down", 502))
      .mockResolvedValueOnce({
        status: "IMPORTED",
        article: { id: "a2", title: "Thor", externalId: "wikipedia:en:Thor" },
      });
    const generatePuzzle = vi.fn(async () => ({
      status: "GENERATED" as const,
      articleId: "a2",
      articleTitle: "Thor",
      puzzleId: "p2",
    }));

    const summary = await processCorpus(
      ["https://en.wikipedia.org/wiki/Iron_Man", "https://en.wikipedia.org/wiki/Thor_(Marvel_Comics)"],
      {
        prisma,
        provider,
        generatorVersion: "2.0.0",
        concurrency: 1,
        delayMs: 0,
        importArticle: importArticle as never,
        generatePuzzle: generatePuzzle as never,
      },
    );

    expect(summary.failed).toBe(1);
    expect(summary.imported).toBe(1);
    expect(summary.puzzlesGenerated).toBe(1);
    expect(summary.items[0]?.stage).toBe("WIKIPEDIA_FETCH");
  });

  it("records validation failures without aborting the batch", async () => {
    const importArticle = vi.fn(async () => ({
      status: "IMPORTED" as const,
      article: { id: "a1", title: "List", externalId: "wikipedia:en:List" },
    }));
    const generatePuzzle = vi.fn(async () => ({
      status: "REJECTED" as const,
      articleId: "a1",
      articleTitle: "List",
      reason: "insufficient title tokens",
    }));

    const summary = await processCorpus(["https://en.wikipedia.org/wiki/Iron_Man"], {
      prisma,
      provider,
      generatorVersion: "2.0.0",
      concurrency: 1,
      delayMs: 0,
      importArticle: importArticle as never,
      generatePuzzle: generatePuzzle as never,
    });

    expect(summary.failed).toBe(1);
    expect(summary.items[0]?.stage).toBe("VALIDATE_PUZZLE");
    expect(summary.items[0]?.error).toContain("insufficient title tokens");
  });

  it("marks invalid URLs as NORMALIZATION failures", async () => {
    const summary = await processCorpus(["not-a-url"], {
      prisma,
      provider,
      generatorVersion: "2.0.0",
      concurrency: 1,
      delayMs: 0,
      importArticle: vi.fn() as never,
      generatePuzzle: vi.fn() as never,
    });
    expect(summary.failed).toBe(1);
    expect(summary.items[0]?.stage).toBe("NORMALIZATION");
  });
});
