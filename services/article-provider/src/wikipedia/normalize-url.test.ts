import { describe, expect, it } from "vitest";
import { WikipediaUrlError } from "./errors.js";
import { normalizeWikipediaUrl } from "./normalize-url.js";

describe("normalizeWikipediaUrl", () => {
  it("normalizes a /wiki/ URL", () => {
    const result = normalizeWikipediaUrl("https://en.wikipedia.org/wiki/Pet_door");
    expect(result).toEqual({
      language: "en",
      title: "Pet_door",
      externalId: "wikipedia:en:Pet_door",
      canonicalUrl: "https://en.wikipedia.org/wiki/Pet_door",
      mediaWikiRawUrl: "https://en.wikipedia.org/w/index.php?title=Pet_door&action=raw",
    });
  });

  it("normalizes a raw MediaWiki URL to the same identity", () => {
    const wiki = normalizeWikipediaUrl("https://en.wikipedia.org/wiki/Pet_door");
    const raw = normalizeWikipediaUrl(
      "https://en.wikipedia.org/w/index.php?title=Pet_door&action=raw",
    );
    expect(raw.externalId).toBe("wikipedia:en:Pet_door");
    expect(raw).toEqual(wiki);
  });

  it("treats query parameter order as equivalent", () => {
    const a = normalizeWikipediaUrl(
      "https://en.wikipedia.org/w/index.php?title=Pet_door&action=raw",
    );
    const b = normalizeWikipediaUrl(
      "https://en.wikipedia.org/w/index.php?action=raw&title=Pet_door",
    );
    expect(a.externalId).toBe(b.externalId);
    expect(a).toEqual(b);
  });

  it("ignores extra query parameters and trailing slashes", () => {
    const result = normalizeWikipediaUrl(
      "https://en.wikipedia.org/wiki/Pet_door/?utm_source=test#History",
    );
    expect(result.externalId).toBe("wikipedia:en:Pet_door");
    expect(result.title).toBe("Pet_door");
  });

  it("decodes URL-encoded titles and converts spaces to underscores", () => {
    const result = normalizeWikipediaUrl("https://en.wikipedia.org/wiki/Pet%20door");
    expect(result.title).toBe("Pet_door");
    expect(result.externalId).toBe("wikipedia:en:Pet_door");
  });

  it("accepts en.m.wikipedia.org as English Wikipedia", () => {
    const result = normalizeWikipediaUrl("https://en.m.wikipedia.org/wiki/Pet_door");
    expect(result.language).toBe("en");
    expect(result.externalId).toBe("wikipedia:en:Pet_door");
    expect(result.canonicalUrl).toBe("https://en.wikipedia.org/wiki/Pet_door");
  });

  it("rejects non-Wikipedia hosts", () => {
    expect(() => normalizeWikipediaUrl("https://google.com/wiki/Pet_door")).toThrow(
      WikipediaUrlError,
    );
    expect(() => normalizeWikipediaUrl("https://example.com/")).toThrow(WikipediaUrlError);
  });

  it("rejects missing titles", () => {
    expect(() => normalizeWikipediaUrl("https://en.wikipedia.org/wiki/")).toThrow(
      WikipediaUrlError,
    );
    expect(() => normalizeWikipediaUrl("https://en.wikipedia.org/w/index.php?action=raw")).toThrow(
      WikipediaUrlError,
    );
  });

  it("rejects unsupported protocols and malformed URLs", () => {
    expect(() => normalizeWikipediaUrl("ftp://en.wikipedia.org/wiki/Pet_door")).toThrow(
      WikipediaUrlError,
    );
    expect(() => normalizeWikipediaUrl("not a url")).toThrow(WikipediaUrlError);
    expect(() => normalizeWikipediaUrl("")).toThrow(WikipediaUrlError);
  });
});
