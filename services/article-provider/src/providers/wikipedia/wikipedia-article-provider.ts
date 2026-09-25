import type { Article } from "@redactle/shared";
import type { ArticleProvider, GetArticlesOptions } from "../types.js";
import { WikipediaProviderError } from "../../wikipedia/errors.js";

export interface WikipediaPageSource {
  title: string;
  language: string;
  revisionId: string;
  canonicalUrl: string;
  wikitext: string;
}

export interface WikipediaProviderOptions {
  apiUrl?: string;
  userAgent?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxRetries?: number;
}

interface MediaWikiRevisionSlot {
  content?: string;
}

interface MediaWikiRevision {
  revid?: number;
  content?: string;
  slots?: {
    main?: MediaWikiRevisionSlot;
  };
}

interface MediaWikiPage {
  title?: string;
  missing?: boolean;
  invalid?: boolean;
  canonicalurl?: string;
  fullurl?: string;
  revisions?: MediaWikiRevision[];
}

interface MediaWikiQueryResponse {
  query?: {
    pages?: MediaWikiPage[];
  };
}

const DEFAULT_API_URL = "https://en.wikipedia.org/w/api.php";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_RETRIES = 4;
const RETRY_STATUS = new Set([429, 503]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WikipediaArticleProvider implements ArticleProvider {
  private readonly apiUrl: string;
  private readonly userAgent: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: WikipediaProviderOptions = {}) {
    this.apiUrl = options.apiUrl?.trim() || DEFAULT_API_URL;
    this.userAgent = options.userAgent?.trim() ?? "";
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  getConfiguredApiUrl(): string {
    return this.apiUrl;
  }

  async getArticleById(_id: string): Promise<Article> {
    throw new Error(
      "WikipediaArticleProvider.getArticleById is not used for import. Use fetchPage.",
    );
  }

  async getArticles(_options?: GetArticlesOptions): Promise<Article[]> {
    throw new Error(
      "WikipediaArticleProvider.getArticles is not used for import. Use fetchPage.",
    );
  }

  async fetchPage(input: { language: string; title: string }): Promise<WikipediaPageSource> {
    if (!this.userAgent) {
      throw new WikipediaProviderError(
        "WIKIPEDIA_USER_AGENT is required for Wikipedia requests.",
        "IMPORT_ERROR",
        500,
      );
    }

    const title = input.title.replace(/_/g, " ");
    const requestUrl = this.buildQueryUrl(title);
    const json = await this.requestJson(requestUrl);
    return this.mapResponse(json, input.language, title);
  }

  private buildQueryUrl(title: string): string {
    const api = new URL(this.apiUrl);
    api.searchParams.set("action", "query");
    api.searchParams.set("format", "json");
    api.searchParams.set("formatversion", "2");
    api.searchParams.set("prop", "revisions|info");
    api.searchParams.set("rvprop", "content|ids");
    api.searchParams.set("rvslots", "main");
    api.searchParams.set("inprop", "url");
    api.searchParams.set("redirects", "1");
    api.searchParams.set("origin", "*");
    api.searchParams.set("titles", title);
    return api.toString();
  }

  private async requestJson(url: string): Promise<MediaWikiQueryResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.fetchFn(url, {
          headers: {
            "User-Agent": this.userAgent,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (RETRY_STATUS.has(response.status) && attempt < this.maxRetries) {
          const backoffMs =
            response.status === 429 ? 8_000 * (attempt + 1) : 250 * (attempt + 1);
          await delay(backoffMs);
          continue;
        }

        if (!response.ok) {
          throw new WikipediaProviderError(
            "Wikipedia API request failed.",
            "WIKIPEDIA_ERROR",
            502,
          );
        }

        const text = await response.text();
        try {
          return JSON.parse(text) as MediaWikiQueryResponse;
        } catch {
          throw new WikipediaProviderError(
            "Wikipedia API returned a malformed response.",
            "WIKIPEDIA_ERROR",
            502,
          );
        }
      } catch (error) {
        lastError = error;
        if (error instanceof WikipediaProviderError) {
          throw error;
        }
        const isTimeout =
          error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        if (attempt < this.maxRetries && (isTimeout || error instanceof TypeError)) {
          await delay(250 * (attempt + 1));
          continue;
        }
        throw new WikipediaProviderError(
          isTimeout ? "Wikipedia API request timed out." : "Wikipedia API request failed.",
          "WIKIPEDIA_ERROR",
          502,
        );
      }
    }

    throw lastError instanceof WikipediaProviderError
      ? lastError
      : new WikipediaProviderError("Wikipedia API request failed.", "WIKIPEDIA_ERROR", 502);
  }

  private mapResponse(
    json: MediaWikiQueryResponse,
    language: string,
    requestedTitle: string,
  ): WikipediaPageSource {
    const page = json.query?.pages?.[0];
    if (!page || page.missing || page.invalid) {
      throw new WikipediaProviderError(
        `Wikipedia page not found: ${requestedTitle}`,
        "NOT_FOUND",
        404,
      );
    }

    const revision = page.revisions?.[0];
    const wikitext = revision?.slots?.main?.content ?? revision?.content ?? "";
    if (!wikitext.trim()) {
      throw new WikipediaProviderError(
        "Wikipedia page has no content.",
        "VALIDATION_ERROR",
        400,
      );
    }

    const title = page.title?.trim() || requestedTitle;
    const canonicalUrl =
      page.canonicalurl ??
      page.fullurl ??
      `https://${language}.wikipedia.org/wiki/${title.replace(/ /g, "_")}`;
    const revisionId = revision?.revid != null ? String(revision.revid) : "";
    if (!revisionId) {
      throw new WikipediaProviderError(
        "Wikipedia API returned a malformed response.",
        "WIKIPEDIA_ERROR",
        502,
      );
    }

    return {
      title,
      language,
      revisionId,
      canonicalUrl,
      wikitext,
    };
  }
}
