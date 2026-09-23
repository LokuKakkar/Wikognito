import { z } from "zod";

export const ArticleSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  title: z.string(),
  source: z.string(),
  sourceUrl: z.string().nullable(),
  revisionId: z.string().nullable(),
  language: z.string(),
  rawContent: z.string(),
  sourceWikitext: z.string().nullable().optional(),
  contentHash: z.string().nullable().optional(),
  wordCount: z.number().int().nonnegative(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const PuzzleStatusSchema = z.enum(["DRAFT", "READY", "PUBLISHED", "ARCHIVED"]);
export type PuzzleStatus = z.infer<typeof PuzzleStatusSchema>;
