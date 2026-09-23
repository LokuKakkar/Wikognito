import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { ImportArticleResponse } from "@redactle/shared";
import {
  normalizeWikipediaUrl,
  wikipediaExternalId,
  type WikipediaPageSource,
} from "@redactle/article-provider";
import {
  convertWikitextToPlaintext,
  countWords,
  hashContent,
  validateNormalizedArticle,
} from "../normalizer/wikitext.js";
import { writeArticleBackup } from "./backup-article.js";
import { ImportError, toImportError } from "./errors.js";
import {
  findArticleByExternalId,
  persistImportedArticle,
  toArticleSummary,
  type ImportedArticleRecord,
} from "./persist-article.js";

export interface WikipediaPageFetcher {
  fetchPage(input: { language: string; title: string }): Promise<WikipediaPageSource>;
}

export interface ImportWikipediaDeps {
  prisma: PrismaClient;
  provider: WikipediaPageFetcher;
}

export async function importWikipediaArticle(
  url: string,
  deps: ImportWikipediaDeps,
): Promise<ImportArticleResponse> {
  try {
    const normalized = normalizeWikipediaUrl(url);
    const existing = await findArticleByExternalId(deps.prisma, normalized.externalId);
    if (existing) {
      return { status: "ALREADY_EXISTS", article: toArticleSummary(existing) };
    }

    const page = await deps.provider.fetchPage({
      language: normalized.language,
      title: normalized.title,
    });

    const canonicalExternalId = wikipediaExternalId(page.language, page.title);
    if (canonicalExternalId !== normalized.externalId) {
      const canonicalExisting = await findArticleByExternalId(deps.prisma, canonicalExternalId);
      if (canonicalExisting) {
        return { status: "ALREADY_EXISTS", article: toArticleSummary(canonicalExisting) };
      }
    }

    const rawContent = convertWikitextToPlaintext(page.wikitext);
    try {
      validateNormalizedArticle({ title: page.title, body: rawContent });
    } catch (error) {
      throw new ImportError(
        "VALIDATION_ERROR",
        error instanceof Error ? error.message : "Article validation failed.",
        400,
      );
    }

    const record: ImportedArticleRecord = {
      id: randomUUID(),
      externalId: canonicalExternalId,
      title: page.title.trim(),
      source: "WIKIPEDIA",
      sourceUrl: page.canonicalUrl,
      revisionId: page.revisionId,
      language: page.language,
      rawContent,
      sourceWikitext: page.wikitext,
      contentHash: hashContent(rawContent),
      wordCount: countWords(rawContent),
    };

    const saved = await persistImportedArticle(deps.prisma, record);

    if (saved.created) {
      try {
        await writeArticleBackup(record);
      } catch (backupError) {
        console.error(
          `Failed to write Wikipedia article backup for ${record.externalId}: ${
            backupError instanceof Error ? backupError.message : String(backupError)
          }`,
        );
      }
    }

    return {
      status: saved.created ? "IMPORTED" : "ALREADY_EXISTS",
      article: saved.article,
    };
  } catch (error) {
    throw toImportError(error);
  }
}
