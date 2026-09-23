import { WikipediaUrlError } from "./errors.js";

export interface NormalizedWikipediaUrl {
  language: string;
  title: string;
  externalId: string;
  canonicalUrl: string;
  mediaWikiRawUrl: string;
}

const SUPPORTED_LANGUAGES = new Set(["en"]);

function languageFromHost(hostname: string): string | null {
  const host = hostname.toLowerCase();
  const match = host.match(/^([a-z]{2,3})(?:\.m)?\.wikipedia\.org$/);
  return match?.[1] ?? null;
}

function decodeTitle(raw: string): string {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    throw new WikipediaUrlError("Please enter a valid Wikipedia article URL.");
  }
  return decoded.replace(/ /g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function encodeWikiPathTitle(title: string): string {
  return encodeURIComponent(title).replace(/%5F/g, "_");
}

export function wikipediaExternalId(language: string, title: string): string {
  const normalizedTitle = title.trim().replace(/ /g, "_");
  return `wikipedia:${language}:${normalizedTitle}`;
}

export function normalizeWikipediaUrl(input: string): NormalizedWikipediaUrl {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new WikipediaUrlError("Please enter a valid Wikipedia article URL.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new WikipediaUrlError("Please enter a valid Wikipedia article URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WikipediaUrlError("Please enter a valid Wikipedia article URL.");
  }

  const language = languageFromHost(url.hostname);
  if (!language) {
    throw new WikipediaUrlError("Please enter a valid Wikipedia article URL.");
  }
  if (!SUPPORTED_LANGUAGES.has(language)) {
    throw new WikipediaUrlError("Please enter a valid Wikipedia article URL.");
  }

  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  let rawTitle: string | null = null;

  if (pathname === "/w/index.php") {
    rawTitle = url.searchParams.get("title");
  } else if (pathname.startsWith("/wiki/")) {
    rawTitle = pathname.slice("/wiki/".length);
  } else {
    throw new WikipediaUrlError("Please enter a valid Wikipedia article URL.");
  }

  if (!rawTitle || !rawTitle.trim()) {
    throw new WikipediaUrlError("Please enter a valid Wikipedia article URL.");
  }

  const title = decodeTitle(rawTitle);
  if (!title) {
    throw new WikipediaUrlError("Please enter a valid Wikipedia article URL.");
  }

  const encodedTitle = encodeWikiPathTitle(title);
  return {
    language,
    title,
    externalId: wikipediaExternalId(language, title),
    canonicalUrl: `https://${language}.wikipedia.org/wiki/${encodedTitle}`,
    mediaWikiRawUrl: `https://${language}.wikipedia.org/w/index.php?title=${encodedTitle}&action=raw`,
  };
}
