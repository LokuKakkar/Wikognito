import type { Article } from "@redactle/shared";
import type { ArticleProvider, GetArticlesOptions } from "../types.js";

/**
 * Deterministic Phase 1 article source.
 * The rest of the app must not know this is dummy data.
 */
const ADA_LOVELACE: Article = {
  id: "article-ada-lovelace",
  externalId: "local:ada-lovelace",
  title: "Ada Lovelace",
  source: "LOCAL",
  sourceUrl: null,
  revisionId: null,
  language: "en",
  rawContent:
    "Ada Lovelace was an English mathematician and writer. She is known for her work on the Analytical Engine. Her notes described an algorithm that could be processed by a machine.",
  wordCount: 31,
};

const ARTICLES: Article[] = [ADA_LOVELACE];

export class LocalArticleProvider implements ArticleProvider {
  async getArticleById(id: string): Promise<Article> {
    const article = ARTICLES.find((a) => a.id === id || a.externalId === id);
    if (!article) {
      throw new Error(`Article not found: ${id}`);
    }
    return { ...article };
  }

  async getArticles(options: GetArticlesOptions = {}): Promise<Article[]> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? ARTICLES.length;
    return ARTICLES.slice(offset, offset + limit).map((a) => ({ ...a }));
  }
}
