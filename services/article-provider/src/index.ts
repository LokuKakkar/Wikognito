import type { ArticleProvider } from "./providers/types.js";
import { LocalArticleProvider } from "./providers/local/local-article-provider.js";
import { WikipediaArticleProvider } from "./providers/wikipedia/wikipedia-article-provider.js";

export type { ArticleProvider, GetArticlesOptions } from "./providers/types.js";
export { LocalArticleProvider } from "./providers/local/local-article-provider.js";
export { WikipediaArticleProvider } from "./providers/wikipedia/wikipedia-article-provider.js";
export type {
  WikipediaPageSource,
  WikipediaProviderOptions,
} from "./providers/wikipedia/wikipedia-article-provider.js";
export { normalizeWikipediaUrl, wikipediaExternalId } from "./wikipedia/normalize-url.js";
export type { NormalizedWikipediaUrl } from "./wikipedia/normalize-url.js";
export { WikipediaUrlError, WikipediaProviderError } from "./wikipedia/errors.js";

export type ArticleSource = "LOCAL" | "WIKIPEDIA";

export function createArticleProvider(
  source: ArticleSource,
  options?: {
    wikipediaApiUrl?: string;
    wikipediaUserAgent?: string;
    fetch?: typeof fetch;
  },
): ArticleProvider {
  switch (source) {
    case "LOCAL":
      return new LocalArticleProvider();
    case "WIKIPEDIA":
      return new WikipediaArticleProvider({
        apiUrl: options?.wikipediaApiUrl,
        userAgent: options?.wikipediaUserAgent,
        fetch: options?.fetch,
      });
    default: {
      const _exhaustive: never = source;
      throw new Error(`Unknown ARTICLE_SOURCE: ${String(_exhaustive)}`);
    }
  }
}
