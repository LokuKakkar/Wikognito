import { describe, expect, it } from "vitest";
import { LocalArticleProvider } from "@redactle/article-provider";
import { runIngestionPipeline } from "./pipeline.js";

describe("ingestion pipeline", () => {
  it("processes the dummy article through the real pipeline", async () => {
    const provider = new LocalArticleProvider();
    const article = (await provider.getArticles())[0]!;
    const result = runIngestionPipeline(article, {
      puzzleId: "puzzle-test",
      puzzleNumber: 1,
      scheduledDate: "2026-08-13",
      generatorVersion: "1.0.0",
    });

    expect(result.generated.titleMatchKey).toBe("ada lovelace");
    expect(result.generated.clientPuzzle.titleTokenIds.length).toBeGreaterThan(0);
    expect(result.generated.uniqueGuessableWordCount).toBeGreaterThanOrEqual(10);
    expect(result.generated.publicDto.payload).toBeTruthy();
    expect(result.generated.publicDto.payload.includes("mathematician")).toBe(false);
  });
});
