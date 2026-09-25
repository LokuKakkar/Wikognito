import { Prisma, type PrismaClient, type Puzzle } from "@prisma/client";
import type { Redis } from "ioredis";
import {
  PublicPuzzleDtoSchema,
  REDIS_PUZZLE_TODAY_KEY,
  type PublicPuzzleDto,
} from "@redactle/shared";
import { computeDifficultyV1, restampPublicPuzzleDto } from "@redactle/puzzle-engine";
import { validateStoredPuzzle } from "../puzzles/validate-stored.js";
import type { PipelineResult } from "./pipeline.js";

export function utcDateOnly(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatUtcDate(date: Date): string {
  return utcDateOnly(date).toISOString().slice(0, 10);
}

export function readyPuzzleId(articleId: string, generatorVersion: string): string {
  return `puzzle-${articleId}-${generatorVersion.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

const ACTIVE_STATUSES = ["DRAFT", "READY", "PUBLISHED"] as const;

export interface PersistReadyResult {
  status: "GENERATED" | "ALREADY_EXISTS";
  articleId: string;
  puzzleId: string;
}

export async function persistReadyPuzzle(
  result: PipelineResult,
  options: {
    prisma: PrismaClient;
    generatorVersion: string;
    force?: boolean;
  },
): Promise<PersistReadyResult> {
  const { prisma, generatorVersion, force = false } = options;
  const { article, generated } = result;

  const savedArticle = await prisma.article.upsert({
    where: { externalId: article.externalId },
    create: {
      id: article.id,
      externalId: article.externalId,
      title: article.title,
      source: article.source,
      sourceUrl: article.sourceUrl,
      revisionId: article.revisionId,
      language: article.language,
      rawContent: article.rawContent,
      wordCount: article.wordCount,
    },
    update: {
      title: article.title,
      rawContent: article.rawContent,
      wordCount: article.wordCount,
      source: article.source,
      language: article.language,
    },
  });

  const existing = await prisma.puzzle.findFirst({
    where: {
      articleId: savedArticle.id,
      generatorVersion,
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing?.status === "PUBLISHED") {
    if (force) {
      throw new Error("Cannot regenerate a published puzzle.");
    }
    return { status: "ALREADY_EXISTS", articleId: savedArticle.id, puzzleId: existing.id };
  }

  if (existing && !force) {
    return { status: "ALREADY_EXISTS", articleId: savedArticle.id, puzzleId: existing.id };
  }

  const puzzleId = existing?.id ?? readyPuzzleId(savedArticle.id, generatorVersion);
  const difficulty = computeDifficultyV1({
    uniqueGuessableWordCount: generated.uniqueGuessableWordCount,
    guessableWordCount: generated.guessableWordCount,
    titleTokenCount: generated.titleTokenCount,
  });
  const data = {
    articleId: savedArticle.id,
    puzzleNumber: 0,
    scheduledDate: null,
    generatorVersion,
    clientPuzzleData: generated.publicDto,
    status: "READY" as const,
    publishedAt: null,
    title: article.title,
    titleMatchKey: generated.titleMatchKey,
    wordCount: generated.wordCount,
    guessableWordCount: generated.guessableWordCount,
    uniqueGuessableWordCount: generated.uniqueGuessableWordCount,
    titleTokenCount: generated.titleTokenCount,
    difficultyValue: difficulty.difficultyValue,
    difficultyVersion: difficulty.difficultyVersion,
  };

  if (existing) {
    await prisma.puzzle.update({
      where: { id: existing.id },
      data,
    });
    return { status: "GENERATED", articleId: savedArticle.id, puzzleId: existing.id };
  }

  await prisma.puzzle.create({
    data: {
      id: puzzleId,
      ...data,
    },
  });

  return { status: "GENERATED", articleId: savedArticle.id, puzzleId };
}

export interface TodayPuzzleCache {
  setToday(dateKey: string, dto: PublicPuzzleDto): Promise<void>;
}

export function createRedisTodayCache(
  redis: Redis | null,
  ttlSeconds = 3600,
): TodayPuzzleCache | null {
  if (!redis) return null;
  return {
    async setToday(dateKey, dto) {
      await redis.set(
        `${REDIS_PUZZLE_TODAY_KEY}:${dateKey}`,
        JSON.stringify(dto),
        "EX",
        ttlSeconds,
      );
    },
  };
}

export interface PublishDailyResult {
  status: "PUBLISHED" | "ALREADY_PUBLISHED" | "NO_CANDIDATE";
  date: string;
  puzzleId?: string;
  puzzleNumber?: number;
  title?: string;
}

function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  if (!field) {
    return true;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes(field);
  }
  if (typeof target === "string") {
    return target.includes(field);
  }
  return false;
}

export async function listEligibleReadyPuzzleIds(prisma: PrismaClient): Promise<string[]> {
  const usedArticles = await prisma.puzzle.findMany({
    where: { status: "PUBLISHED" },
    select: { articleId: true },
    distinct: ["articleId"],
  });
  const usedIds = usedArticles.map((row) => row.articleId);
  const rows = await prisma.puzzle.findMany({
    where: {
      status: "READY",
      articleId: usedIds.length > 0 ? { notIn: usedIds } : undefined,
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function selectReadyPuzzle(prisma: PrismaClient) {
  const ids = await listEligibleReadyPuzzleIds(prisma);
  if (ids.length === 0) {
    return null;
  }
  const id = ids[Math.floor(Math.random() * ids.length)]!;
  return prisma.puzzle.findUnique({ where: { id } });
}

async function findPublishedAssignment(
  prisma: PrismaClient,
  dateOnly: Date,
  dateKey: string,
): Promise<PublishDailyResult | null> {
  const existingAssignment = await prisma.dailyPuzzle.findUnique({
    where: { date: dateOnly },
    include: { puzzle: true },
  });
  if (!existingAssignment) {
    return null;
  }
  return {
    status: "ALREADY_PUBLISHED",
    date: dateKey,
    puzzleId: existingAssignment.puzzleId,
    puzzleNumber: existingAssignment.puzzle.puzzleNumber,
    title: existingAssignment.puzzle.title,
  };
}

async function publishSelectedPuzzle(options: {
  prisma: PrismaClient;
  selected: Puzzle;
  dateOnly: Date;
  dateKey: string;
  cache?: TodayPuzzleCache | null;
}): Promise<PublishDailyResult> {
  const { prisma, selected, dateOnly, dateKey } = options;
  const articleAlreadyUsed = await prisma.puzzle.findFirst({
    where: { articleId: selected.articleId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (articleAlreadyUsed) {
    throw new Error("This article already has a published daily puzzle.");
  }

  const maxNumber = await prisma.puzzle.aggregate({ _max: { puzzleNumber: true } });
  const puzzleNumber = Math.max(maxNumber._max.puzzleNumber ?? 0, 0) + 1;
  const currentDto = PublicPuzzleDtoSchema.parse(selected.clientPuzzleData);
  const stamped = restampPublicPuzzleDto(currentDto, {
    id: selected.id,
    puzzleNumber,
    scheduledDate: dateKey,
  });

  await prisma.$transaction(async (tx) => {
    await tx.puzzle.update({
      where: { id: selected.id },
      data: {
        status: "PUBLISHED",
        scheduledDate: dateOnly,
        puzzleNumber,
        publishedAt: new Date(),
        clientPuzzleData: stamped,
      },
    });
    await tx.dailyPuzzle.create({
      data: {
        date: dateOnly,
        puzzleId: selected.id,
      },
    });
  });

  if (options.cache) {
    await options.cache.setToday(dateKey, stamped);
  }

  return {
    status: "PUBLISHED",
    date: dateKey,
    puzzleId: selected.id,
    puzzleNumber,
    title: selected.title,
  };
}

export async function publishDailyPuzzle(options: {
  prisma: PrismaClient;
  date?: Date;
  puzzleId?: string;
  cache?: TodayPuzzleCache | null;
}): Promise<PublishDailyResult> {
  const { prisma, puzzleId } = options;
  const dateOnly = utcDateOnly(options.date ?? new Date());
  const dateKey = formatUtcDate(dateOnly);

  const existingAssignment = await findPublishedAssignment(prisma, dateOnly, dateKey);
  if (existingAssignment) {
    return existingAssignment;
  }

  if (puzzleId) {
    const selected = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
    if (!selected) {
      throw new Error("No READY puzzle is available to publish.");
    }
    if (selected.status === "PUBLISHED") {
      throw new Error("Puzzle is already published.");
    }
    if (selected.status !== "READY") {
      throw new Error(`Puzzle ${selected.id} is ${selected.status}, not READY.`);
    }
    if (!validateStoredPuzzle(selected).ok) {
      throw new Error("Selected puzzle failed validation.");
    }
    try {
      return await publishSelectedPuzzle({
        prisma,
        selected,
        dateOnly,
        dateKey,
        cache: options.cache,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const published = await findPublishedAssignment(prisma, dateOnly, dateKey);
        if (published) {
          return published;
        }
      }
      throw error;
    }
  }

  const remaining = await listEligibleReadyPuzzleIds(prisma);
  while (remaining.length > 0) {
    const index = Math.floor(Math.random() * remaining.length);
    const [candidateId] = remaining.splice(index, 1);
    const candidate = await prisma.puzzle.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.status !== "READY") {
      continue;
    }
    if (!validateStoredPuzzle(candidate).ok) {
      continue;
    }
    try {
      return await publishSelectedPuzzle({
        prisma,
        selected: candidate,
        dateOnly,
        dateKey,
        cache: options.cache,
      });
    } catch (error) {
      if (isUniqueViolation(error, "date") || isUniqueViolation(error, "DailyPuzzle_pkey")) {
        const published = await findPublishedAssignment(prisma, dateOnly, dateKey);
        if (published) {
          return published;
        }
      }
      if (isUniqueViolation(error, "puzzleId")) {
        continue;
      }
      if (error instanceof Error && error.message.includes("already has a published daily puzzle")) {
        continue;
      }
      throw error;
    }
  }

  return { status: "NO_CANDIDATE", date: dateKey };
}

/**
 * Seed helper: ensure a generated puzzle is assigned to `scheduledDate`.
 * Idempotent when that date is already published. Does not overwrite a
 * published puzzle for a different date.
 */
export async function persistPipelineResult(
  result: PipelineResult,
  options: {
    prisma: PrismaClient;
    scheduledDate: Date;
    puzzleNumber: number;
    generatorVersion: string;
    cache?: TodayPuzzleCache | null;
  },
): Promise<{ articleId: string; puzzleId: string }> {
  const dateOnly = utcDateOnly(options.scheduledDate);
  const existingDaily = await options.prisma.dailyPuzzle.findUnique({
    where: { date: dateOnly },
    include: { puzzle: true },
  });
  if (existingDaily) {
    return { articleId: existingDaily.puzzle.articleId, puzzleId: existingDaily.puzzleId };
  }

  const ready = await persistReadyPuzzle(result, {
    prisma: options.prisma,
    generatorVersion: options.generatorVersion,
    force: true,
  });
  const published = await publishDailyPuzzle({
    prisma: options.prisma,
    date: options.scheduledDate,
    puzzleId: ready.puzzleId,
    cache: options.cache,
  });
  return { articleId: ready.articleId, puzzleId: published.puzzleId ?? ready.puzzleId };
}
