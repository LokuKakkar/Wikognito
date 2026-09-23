import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { WikipediaProviderError } from "../../wikipedia/errors.js";
import { WikipediaArticleProvider } from "./wikipedia-article-provider.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, "fixtures", name), "utf8");
}

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createProvider(fetchImpl: typeof fetch) {
  return new WikipediaArticleProvider({
    apiUrl: "https://en.wikipedia.org/w/api.php",
    userAgent: "RedactleClone/1.0 (tests@example.com)",
    fetch: fetchImpl,
    maxRetries: 0,
  });
}

describe("WikipediaArticleProvider.fetchPage", () => {
  it("maps a successful MediaWiki response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(loadFixture("successful-article.json")));
    const provider = createProvider(fetchImpl);

    const page = await provider.fetchPage({ language: "en", title: "Pet_door" });

    expect(page.title).toBe("Pet door");
    expect(page.language).toBe("en");
    expect(page.revisionId).toBe("123456789");
    expect(page.canonicalUrl).toBe("https://en.wikipedia.org/wiki/Pet_door");
    expect(page.wikitext).toContain("pet door");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("action=query"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": "RedactleClone/1.0 (tests@example.com)",
        }),
      }),
    );
    const requested = String(fetchImpl.mock.calls.at(0)?.at(0) ?? "");
    expect(requested).toContain("titles=Pet+door");
  });

  it("throws NOT_FOUND for a missing page", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(loadFixture("not-found.json")));
    const provider = createProvider(fetchImpl);

    await expect(provider.fetchPage({ language: "en", title: "Missing" })).rejects.toMatchObject({
      name: "WikipediaProviderError",
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });

  it("throws WIKIPEDIA_ERROR for malformed JSON", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(loadFixture("malformed-response.txt")));
    const provider = createProvider(fetchImpl);

    await expect(provider.fetchPage({ language: "en", title: "Pet_door" })).rejects.toMatchObject({
      code: "WIKIPEDIA_ERROR",
      statusCode: 502,
    });
  });

  it("throws VALIDATION_ERROR for empty wikitext", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(loadFixture("empty-content.json")));
    const provider = createProvider(fetchImpl);

    await expect(provider.fetchPage({ language: "en", title: "Empty_page" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });

  it("fails clearly when User-Agent is missing", async () => {
    const fetchImpl = vi.fn();
    const provider = new WikipediaArticleProvider({
      userAgent: "",
      fetch: fetchImpl,
    });

    await expect(provider.fetchPage({ language: "en", title: "Pet_door" })).rejects.toBeInstanceOf(
      WikipediaProviderError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
