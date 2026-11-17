import type { PrismaClient } from "@prisma/client";

const BATCH_SIZE = 2_000;
const MAX_BATCHES_PER_RUN = 50;

/**
 * Deletes anonymous sessions that expired and left nothing behind (no account, no game result).
 * Without this the Session table only ever grows, which a request flood can turn into a full disk.
 * Works in small batches so one run never holds a long lock after a large flood.
 */
export async function purgeExpiredSessions(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<number> {
  let removed = 0;
  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const stale = await prisma.session.findMany({
      where: { expiresAt: { lt: now }, userId: null, gameResults: { none: {} } },
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (stale.length === 0) break;
    const result = await prisma.session.deleteMany({
      where: { id: { in: stale.map((row) => row.id) } },
    });
    removed += result.count;
    if (stale.length < BATCH_SIZE) break;
  }
  return removed;
}

export function startSessionCleanup(options: {
  prisma: PrismaClient;
  log: (event: string, fields: Record<string, unknown>) => void;
  intervalMs?: number;
}): () => void {
  const run = async () => {
    try {
      const removed = await purgeExpiredSessions(options.prisma);
      if (removed > 0) options.log("expired_sessions_purged", { removed });
    } catch (error) {
      options.log("session_cleanup_failed", {
        message: error instanceof Error ? error.message : "Session cleanup failed.",
      });
    }
  };
  const first = setTimeout(() => void run(), 60_000);
  const timer = setInterval(() => void run(), options.intervalMs ?? 60 * 60 * 1000);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
