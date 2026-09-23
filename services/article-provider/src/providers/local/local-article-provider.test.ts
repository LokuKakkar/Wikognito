import { describe, expect, it } from "vitest";
import { LocalArticleProvider } from "./local-article-provider.js";

describe("LocalArticleProvider", () => {
  it("returns the Ada Lovelace article", async () => {
    const provider = new LocalArticleProvider();
    const articles = await provider.getArticles();
    expect(articles).toHaveLength(1);
    expect(articles[0]?.title).toBe("Ada Lovelace");
    expect(articles[0]?.rawContent.length).toBeGreaterThan(0);
  });

  it("looks up by id", async () => {
    const provider = new LocalArticleProvider();
    const article = await provider.getArticleById("article-ada-lovelace");
    expect(article.externalId).toBe("local:ada-lovelace");
  });
});
