import type { PrismaClient } from "@prisma/client";
import { GameRepository } from "../games/game.repository.js";
import { recomputePuzzleStats } from "../games/puzzle-stats.js";
import { hashPassword } from "../auth/password.js";
import {
  CROWD_PASSWORD,
  CROWD_PLAYERS,
  crowdPlaysForDate,
  difficultyForPuzzle,
  utcDateKey,
  type CrowdPlay,
} from "./crowd-roster.js";

const SESSION_EXPIRES_AT = new Date("2099-01-01T00:00:00.000Z");

let passwordHashPromise: Promise<string> | null = null;
let accountsReady = false;
let historyDone = false;
const seededDates = new Set<string>();

function passwordHash(): Promise<string> {
  passwordHashPromise ??= hashPassword(CROWD_PASSWORD);
  return passwordHashPromise;
}

async function retireRemovedCrowd(prisma: PrismaClient): Promise<void> {
  const keepUserIds = CROWD_PLAYERS.map((player) => player.id);
  const keepSessionIds = CROWD_PLAYERS.map((player) => player.sessionId);
  const staleUser = { startsWith: "crowd-", notIn: keepUserIds };
  const staleSession = { startsWith: "session-crowd-", notIn: keepSessionIds };
  await prisma.gameResult.deleteMany({
    where: { OR: [{ userId: staleUser }, { sessionId: staleSession }] },
  });
  await prisma.authToken.deleteMany({ where: { userId: staleUser } });
  await prisma.authIdentity.deleteMany({ where: { userId: staleUser } });
  await prisma.session.deleteMany({ where: { id: staleSession } });
  await prisma.user.deleteMany({ where: { id: staleUser } });
}

async function ensureAccounts(prisma: PrismaClient): Promise<void> {
  if (accountsReady) return;
  await retireRemovedCrowd(prisma);
  const hashed = await passwordHash();
  for (const player of CROWD_PLAYERS) {
    await prisma.user.upsert({
      where: { id: player.id },
      create: {
        id: player.id,
        email: player.email,
        displayName: player.displayName,
        role: "USER",
        emailVerifiedAt: new Date(),
      },
      update: {
        email: player.email,
        displayName: player.displayName,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.authIdentity.upsert({
      where: {
        provider_providerSubject: {
          provider: "EMAIL",
          providerSubject: player.email,
        },
      },
      create: {
        userId: player.id,
        provider: "EMAIL",
        providerSubject: player.email,
        passwordHash: hashed,
      },
      update: {
        userId: player.id,
        passwordHash: hashed,
      },
    });
    await prisma.session.upsert({
      where: { id: player.sessionId },
      create: {
        id: player.sessionId,
        userId: player.id,
        expiresAt: SESSION_EXPIRES_AT,
      },
      update: {
        userId: player.id,
        expiresAt: SESSION_EXPIRES_AT,
      },
    });
  }
  accountsReady = true;
}

interface DailyAssignment {
  date: Date;
  puzzleId: string;
  puzzle: {
    status: string;
    difficultyValue: number;
    difficultyVersion: number;
    uniqueGuessableWordCount: number;
    guessableWordCount: number;
    titleTokenCount: number;
  };
}

async function insertPlays(
  prisma: PrismaClient,
  puzzleId: string,
  dateKey: string,
  plays: CrowdPlay[],
): Promise<number> {
  const existing = await prisma.gameResult.findMany({
    where: {
      puzzleId,
      isOfficial: true,
      userId: { in: plays.map((play) => play.player.id) },
    },
    select: {
      id: true,
      userId: true,
      attemptId: true,
      guessCount: true,
      hitGuessCount: true,
      durationMs: true,
      score: true,
    },
  });
  const byUser = new Map(existing.map((row) => [row.userId, row]));
  const missing = plays.filter((play) => !byUser.has(play.player.id));
  const stale = plays.filter((play) => {
    const row = byUser.get(play.player.id);
    if (!row?.attemptId.startsWith("crowd-")) return false;
    return (
      row.guessCount !== play.guessCount ||
      row.hitGuessCount !== play.hitGuessCount ||
      row.durationMs !== play.durationMs ||
      row.score !== play.score
    );
  });
  if (missing.length > 0) {
    await prisma.gameResult.createMany({
      data: missing.map((play) => ({
        userId: play.player.id,
        sessionId: play.player.sessionId,
        puzzleId,
        attemptId: `crowd-${play.player.id}-${dateKey}`,
        attemptNumber: 1,
        isOfficial: true,
        source: "DAILY" as const,
        startedAt: play.startedAt,
        completedAt: play.completedAt,
        durationMs: play.durationMs,
        guessCount: play.guessCount,
        hitGuessCount: play.hitGuessCount,
        won: true,
        score: play.score,
        scoreVersion: play.scoreVersion,
        status: "WON",
      })),
    });
  }

  for (const play of stale) {
    const row = byUser.get(play.player.id);
    if (!row) continue;
    await prisma.gameResult.update({
      where: { id: row.id },
      data: {
        startedAt: play.startedAt,
        completedAt: play.completedAt,
        durationMs: play.durationMs,
        guessCount: play.guessCount,
        hitGuessCount: play.hitGuessCount,
        score: play.score,
        scoreVersion: play.scoreVersion,
      },
    });
  }

  const changed = missing.length + stale.length;
  const games = new GameRepository(prisma);
  const stored = await games.findPuzzleStats(puzzleId);
  if (changed > 0 || !stored || stored.gamesPlayed === 0) {
    const rows = await games.listOfficialDailyForPuzzle(puzzleId);
    await games.upsertPuzzleStats(recomputePuzzleStats(puzzleId, rows));
  }
  return changed;
}

async function seedAssignment(prisma: PrismaClient, assignment: DailyAssignment, now: Date): Promise<number> {
  if (assignment.puzzle.status !== "PUBLISHED") return 0;
  const dateKey = utcDateKey(assignment.date);
  const plays = crowdPlaysForDate(dateKey, difficultyForPuzzle(assignment.puzzle), now);
  return insertPlays(prisma, assignment.puzzleId, dateKey, plays);
}

/** Official finishes for the current UTC daily puzzle. Safe to call on every today request. */
export async function ensureCrowdForToday(prisma: PrismaClient, now: Date = new Date()): Promise<number> {
  await ensureAccounts(prisma);
  const dateKey = utcDateKey(now);
  if (seededDates.has(dateKey)) return 0;
  const dateOnly = new Date(`${dateKey}T00:00:00.000Z`);
  const assignment = await prisma.dailyPuzzle.findUnique({
    where: { date: dateOnly },
    include: {
      puzzle: {
        select: {
          status: true,
          difficultyValue: true,
          difficultyVersion: true,
          uniqueGuessableWordCount: true,
          guessableWordCount: true,
          titleTokenCount: true,
        },
      },
    },
  });
  if (!assignment) return 0;
  const inserted = await seedAssignment(prisma, assignment, now);
  seededDates.add(dateKey);
  return inserted;
}

/** Earlier daily puzzles, so the crowd does not have a perfect streak. */
export async function ensureCrowdHistory(prisma: PrismaClient, now: Date = new Date()): Promise<number> {
  if (historyDone) return 0;
  await ensureAccounts(prisma);
  const todayKey = utcDateKey(now);
  const assignments = await prisma.dailyPuzzle.findMany({
    include: {
      puzzle: {
        select: {
          status: true,
          difficultyValue: true,
          difficultyVersion: true,
          uniqueGuessableWordCount: true,
          guessableWordCount: true,
          titleTokenCount: true,
        },
      },
    },
  });
  let inserted = 0;
  for (const assignment of assignments) {
    const dateKey = utcDateKey(assignment.date);
    if (dateKey === todayKey || seededDates.has(dateKey)) continue;
    inserted += await seedAssignment(prisma, assignment, now);
    seededDates.add(dateKey);
  }
  historyDone = true;
  return inserted;
}

export async function ensureCrowdPlay(prisma: PrismaClient, now: Date = new Date()): Promise<number> {
  const today = await ensureCrowdForToday(prisma, now);
  const history = await ensureCrowdHistory(prisma, now);
  return today + history;
}
