import type { Article } from "@redactle/shared";

export interface GetArticlesOptions {
  limit?: number;
  offset?: number;
}

export interface ArticleProvider {
  getArticleById(id: string): Promise<Article>;
  getArticles(options?: GetArticlesOptions): Promise<Article[]>;
}
