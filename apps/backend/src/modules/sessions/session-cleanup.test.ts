import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { purgeExpiredSessions } from "./session-cleanup.js";

describe("purgeExpiredSessions", () => {
  it("deletes only expired anonymous sessions with no game results, in batches", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce(Array.from({ length: 2000 }, (_, i) => ({ id: `a${i}` })))
      .mockResolvedValueOnce([{ id: "b1" }, { id: "b2" }]);
    const deleteMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 2000 })
      .mockResolvedValueOnce({ count: 2 });
    const prisma = { session: { findMany, deleteMany } } as unknown as PrismaClient;
    const now = new Date("2026-11-16T00:00:00Z");

    const removed = await purgeExpiredSessions(prisma, now);

    expect(removed).toBe(2002);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      expiresAt: { lt: now },
      userId: null,
      gameResults: { none: {} },
    });
  });

  it("does nothing when there is nothing stale", async () => {
    const prisma = {
      session: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    } as unknown as PrismaClient;
    expect(await purgeExpiredSessions(prisma)).toBe(0);
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });
});
