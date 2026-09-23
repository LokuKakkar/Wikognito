import type { ClientPuzzle } from "@redactle/shared";
import { decodeClientPayload, generatePuzzle } from "@redactle/puzzle-engine";

export const DUMMY_ARTICLE = {
  id: "article-ada-lovelace",
  externalId: "local:ada-lovelace",
  title: "Ada Lovelace",
  source: "LOCAL",
  sourceUrl: null as string | null,
  revisionId: null as string | null,
  language: "en",
  rawContent:
    "Ada Lovelace was an English mathematician and writer. She is known for her work on the Analytical Engine. Her notes described an algorithm that could be processed by a machine.",
  wordCount: 0,
};

export function createDummyClientPuzzle(overrides?: Partial<ClientPuzzle>): ClientPuzzle {
  const generated = generatePuzzle({
    puzzleId: overrides?.puzzleId ?? "puzzle-ada",
    puzzleNumber: overrides?.puzzleNumber ?? 1,
    scheduledDate: overrides?.scheduledDate ?? "2026-08-13",
    generatorVersion: overrides?.generatorVersion ?? "1.0.0",
    title: DUMMY_ARTICLE.title,
    body: DUMMY_ARTICLE.rawContent,
  });
  const decoded = decodeClientPayload(generated.publicDto.payload);
  return { ...decoded, ...overrides };
}
