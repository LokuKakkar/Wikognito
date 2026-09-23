import { generatePuzzle, type GeneratedPuzzle } from "@redactle/puzzle-engine";
import type { Article } from "@redactle/shared";
import { parseArticle } from "../parser/parser.js";
import { validateGeneratedPuzzle } from "../validator/validator.js";

export interface PipelineOptions {
  puzzleId: string;
  puzzleNumber: number;
  scheduledDate: string;
  generatorVersion: string;
}

export interface PipelineResult {
  article: Article;
  generated: GeneratedPuzzle;
}

/**
 * Article ingestion pipeline (independent of HTTP):
 * Parse → Normalize (via engine) → Tokenize → Redact → Client puzzle → Validate
 */
export function runIngestionPipeline(article: Article, options: PipelineOptions): PipelineResult {
  const parsed = parseArticle(article);
  const generated = generatePuzzle({
    puzzleId: options.puzzleId,
    puzzleNumber: options.puzzleNumber,
    scheduledDate: options.scheduledDate,
    generatorVersion: options.generatorVersion,
    title: parsed.title,
    body: parsed.body,
  });
  validateGeneratedPuzzle(generated);

  const wordCount = generated.wordCount;
  return {
    article: {
      ...article,
      title: parsed.title,
      rawContent: parsed.body,
      wordCount,
    },
    generated,
  };
}
