import type { Article } from "@redactle/shared";

export interface ParsedArticle {
  title: string;
  body: string;
  language: string;
  externalId: string;
  source: string;
  sourceUrl: string | null;
  revisionId: string | null;
  articleId: string;
}

/**
 * Parse a provider Article into pipeline input.
 * Phase 1: rawContent is plain text body (title is separate).
 */
export function parseArticle(article: Article): ParsedArticle {
  const body = article.rawContent.trim();
  if (!article.title.trim()) {
    throw new Error("Article title is empty");
  }
  if (!body) {
    throw new Error("Article body is empty");
  }

  return {
    title: article.title.trim(),
    body,
    language: article.language,
    externalId: article.externalId,
    source: article.source,
    sourceUrl: article.sourceUrl,
    revisionId: article.revisionId,
    articleId: article.id,
  };
}
