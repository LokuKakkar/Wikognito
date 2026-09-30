import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { createRedisTodayCache, publishDailyPuzzle } from "@redactle/article-ingestion";

export function msUntilNextUtcMidnight(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(next - now.getTime(), 1_000);
}

export function startDailyPublishScheduler(options: {
  prisma: PrismaClient;
  redis: Redis | null;
  log: (event: string, fields: Record<string, unknown>) => void;
}): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const publish = async (reason: string) => {
    if (stopped) return;
    try {
      const result = await publishDailyPuzzle({
        prisma: options.prisma,
        cache: createRedisTodayCache(options.redis),
      });
      const event =
        result.status === "PUBLISHED"
          ? "daily_publish_success"
          : result.status === "ALREADY_PUBLISHED"
            ? "daily_publish_already_published"
            : "daily_publish_no_candidate";
      options.log(event, { reason, status: result.status, puzzleId: result.puzzleId, date: result.date });
    } catch (error) {
      options.log("daily_publish_failed", {
        reason,
        message: error instanceof Error ? error.message : "Could not publish today's puzzle.",
      });
    }
  };

  const arm = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      void publish("utc_midnight").finally(arm);
    }, msUntilNextUtcMidnight());
  };

  void publish("startup");
  arm();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
