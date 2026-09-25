import type { PrismaClient } from "@prisma/client";
import type { WikipediaPageFetcher } from "../import/import-wikipedia.js";
import { processCorpus, type CorpusSummary, type ProcessCorpusOptions } from "./process-corpus.js";

export interface DossierSeedDefinition {
  slug: string;
  title: string;
  description?: string;
  coverImage?: string | null;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  articles: string[];
}

export interface DossierSeedResult {
  dossierId: string;
  slug: string;
  created: boolean;
  casesAdded: number;
  casesAlreadyExisting: number;
  corpus: CorpusSummary;
  failed: Array<{ url: string; stage: string; error: string }>;
}

export interface SeedDossierOptions extends ProcessCorpusOptions {
  prisma: PrismaClient;
  provider: WikipediaPageFetcher;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseDossierSeedDefinition(input: unknown): DossierSeedDefinition {
  if (!input || typeof input !== "object") {
    throw new Error("Dossier seed file must be a JSON object.");
  }
  const raw = input as Record<string, unknown>;
  const slug = typeof raw.slug === "string" ? slugify(raw.slug) : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!slug) {
    throw new Error("Dossier seed requires a slug.");
  }
  if (!title) {
    throw new Error("Dossier seed requires a title.");
  }
  if (!Array.isArray(raw.articles) || raw.articles.some((item) => typeof item !== "string")) {
    throw new Error("Dossier seed requires an articles array of Wikipedia URLs.");
  }
  const status =
    raw.status === "PUBLISHED" || raw.status === "ARCHIVED" || raw.status === "DRAFT"
      ? raw.status
      : "DRAFT";
  return {
    slug,
    title,
    description: typeof raw.description === "string" ? raw.description : "",
    coverImage: typeof raw.coverImage === "string" ? raw.coverImage : null,
    status,
    articles: raw.articles.map((item) => item.trim()).filter((item) => item.length > 0),
  };
}

export async function seedDossier(
  definition: DossierSeedDefinition,
  options: SeedDossierOptions,
): Promise<DossierSeedResult> {
  const corpus = await processCorpus(definition.articles, options);
  const existing = await options.prisma.dossier.findUnique({
    where: { slug: definition.slug },
    include: { caseFiles: true },
  });

  const dossier = existing
    ? await options.prisma.dossier.update({
        where: { id: existing.id },
        data: {
          title: definition.title,
          description: definition.description ?? "",
          coverImage: definition.coverImage ?? existing.coverImage,
          status: definition.status ?? existing.status,
        },
      })
    : await options.prisma.dossier.create({
        data: {
          slug: definition.slug,
          title: definition.title,
          description: definition.description ?? "",
          coverImage: definition.coverImage,
          status: definition.status ?? "DRAFT",
        },
      });

  const existingPuzzleIds = new Set((existing?.caseFiles ?? []).map((row) => row.puzzleId));
  let nextPosition =
    (existing?.caseFiles.reduce((max, row) => Math.max(max, row.position), 0) ?? 0) + 1;
  let casesAdded = 0;
  let casesAlreadyExisting = 0;
  const failed = corpus.items
    .filter((item) => item.articleStatus === "failed" || item.puzzleStatus === "failed")
    .map((item) => ({
      url: item.url,
      stage: item.stage ?? "UNKNOWN",
      error: item.error ?? "Unknown corpus failure.",
    }));

  for (const item of corpus.items) {
    if (!item.puzzleId) {
      if (item.articleStatus !== "failed" && item.puzzleStatus !== "failed") {
        failed.push({
          url: item.url,
          stage: "DOSSIER_LINK",
          error: "No puzzle was available to attach.",
        });
      }
      continue;
    }
    if (existingPuzzleIds.has(item.puzzleId)) {
      casesAlreadyExisting += 1;
      continue;
    }
    try {
      await options.prisma.dossierCaseFile.create({
        data: {
          dossierId: dossier.id,
          puzzleId: item.puzzleId,
          position: nextPosition,
        },
      });
      existingPuzzleIds.add(item.puzzleId);
      nextPosition += 1;
      casesAdded += 1;
    } catch (error) {
      failed.push({
        url: item.url,
        stage: "DOSSIER_LINK",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    dossierId: dossier.id,
    slug: dossier.slug,
    created: !existing,
    casesAdded,
    casesAlreadyExisting,
    corpus,
    failed,
  };
}
