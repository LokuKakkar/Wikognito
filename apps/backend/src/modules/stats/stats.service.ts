import { guessAccuracy } from "@redactle/puzzle-engine";
import { ACTIVITY_CALENDAR_START, type ActivityDay, type StatsResponse, type TrendPoint, type UserStatsResponse } from "@redactle/shared";
import type { OfficialUserResult, StatsRepository } from "./stats.repository.js";

export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateKey(date);
}

export function computeStreaks(
  results: OfficialUserResult[],
  now: Date = new Date(),
): { currentStreak: number; longestStreak: number } {
  const byDate = new Map<string, OfficialUserResult>();
  for (const result of results) {
    if (result.source !== "DAILY") continue;
    if (!result.dailyDate) continue;
    const key = utcDateKey(result.dailyDate);
    const existing = byDate.get(key);
    if (!existing) {
      byDate.set(key, result);
    }
  }

  const dates = [...byDate.keys()].sort();
  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of dates) {
    const result = byDate.get(date)!;
    if (!result.won) {
      run = 0;
      previous = date;
      continue;
    }
    if (previous && addUtcDays(previous, 1) === date && byDate.get(previous)?.won) {
      run += 1;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    previous = date;
  }

  const today = utcDateKey(now);
  const yesterday = addUtcDays(today, -1);
  const startDate = byDate.has(today) ? today : yesterday;
  const start = byDate.get(startDate);
  if (!start?.won) {
    return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 0;
  let cursor = startDate;
  while (true) {
    const result = byDate.get(cursor);
    if (!result?.won) break;
    currentStreak += 1;
    cursor = addUtcDays(cursor, -1);
  }

  return { currentStreak, longestStreak };
}

export function calendarStartFromFirstDaily(_firstDailyDate?: Date | null, _now: Date = new Date()): string {
  return ACTIVITY_CALENDAR_START;
}

export function buildActivity(
  results: OfficialUserResult[],
  _now: Date = new Date(),
  calendarStart?: string,
): ActivityDay[] {
  const start = calendarStart ?? ACTIVITY_CALENDAR_START;
  const byDate = new Map<string, ActivityDay>();
  for (const result of results) {
    if (result.source !== "DAILY" || !result.dailyDate) continue;
    const date = utcDateKey(result.dailyDate);
    if (date < start) continue;
    byDate.set(date, {
      date,
      puzzleNumber: result.puzzleNumber,
      status: result.status === "GAVE_UP" ? "GAVE_UP" : "WON",
      guessCount: result.guessCount,
      durationMs: result.durationMs,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildTrends(results: OfficialUserResult[], now: Date = new Date(), weeks = 12): TrendPoint[] {
  const today = utcDateKey(now);
  const points: TrendPoint[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekEnd = addUtcDays(today, -index * 7);
    const weekStart = addUtcDays(weekEnd, -6);
    const inWeek = results.filter((result) => {
      const key = utcDateKey(result.completedAt);
      return key >= weekStart && key <= weekEnd;
    });
    const won = inWeek.filter((result) => result.won);
    points.push({
      weekStart,
      gamesPlayed: inWeek.length,
      gamesWon: won.length,
      winRate: inWeek.length === 0 ? 0 : won.length / inWeek.length,
      averageGuesses:
        won.length === 0 ? null : won.reduce((sum, result) => sum + result.guessCount, 0) / won.length,
      averageCompletionTimeMs:
        won.length === 0
          ? null
          : Math.round(won.reduce((sum, result) => sum + result.durationMs, 0) / won.length),
    });
  }
  return points;
}

export function aggregateUserStats(
  results: OfficialUserResult[],
  now: Date = new Date(),
  calendarStart?: string,
): UserStatsResponse {
  const gamesPlayed = results.length;
  const gamesWon = results.filter((result) => result.won).length;
  const gamesGaveUp = results.filter((result) => result.status === "GAVE_UP").length;
  const winRate = gamesPlayed === 0 ? 0 : gamesWon / gamesPlayed;
  const won = results.filter((result) => result.won);
  const averageGuesses =
    won.length === 0
      ? null
      : won.reduce((sum, result) => sum + result.guessCount, 0) / won.length;
  const wonDurations = won.map((result) => result.durationMs);
  const averageCompletionTimeMs =
    wonDurations.length === 0
      ? null
      : Math.round(wonDurations.reduce((sum, value) => sum + value, 0) / wonDurations.length);
  const { currentStreak, longestStreak } = computeStreaks(results, now);
  const withAccuracy = results.filter((result) => result.hitGuessCount != null && result.guessCount > 0);
  const accuracy =
    withAccuracy.length === 0
      ? null
      : withAccuracy.reduce(
          (sum, result) => sum + (guessAccuracy(result.hitGuessCount ?? 0, result.guessCount) ?? 0),
          0,
        ) / withAccuracy.length;

  return {
    gamesPlayed,
    gamesWon,
    gamesGaveUp,
    winRate,
    currentStreak,
    longestStreak,
    averageGuesses,
    averageCompletionTimeMs,
    guessAccuracy: accuracy,
    calendarStart: calendarStart ?? ACTIVITY_CALENDAR_START,
    activity: buildActivity(results, now, calendarStart),
    trends: buildTrends(results, now),
  };
}

export class StatsService {
  constructor(private readonly stats: StatsRepository) {}

  async getForSession(sessionId: string | undefined): Promise<StatsResponse> {
    if (!sessionId) {
      return {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesGaveUp: 0,
        averageGuesses: null,
        bestGuessCount: null,
      };
    }

    const results = await this.stats.aggregateOfficialForSession(sessionId);
    const gamesPlayed = results.length;
    const gamesWon = results.filter((result) => result.won).length;
    const gamesGaveUp = results.filter((result) => result.status === "GAVE_UP").length;
    const averageGuesses =
      gamesPlayed === 0
        ? null
        : results.reduce((sum, result) => sum + result.guessCount, 0) / gamesPlayed;
    const wonGuessCounts = results.filter((result) => result.won).map((result) => result.guessCount);
    const bestGuessCount = wonGuessCounts.length ? Math.min(...wonGuessCounts) : null;

    return {
      gamesPlayed,
      gamesWon,
      gamesGaveUp,
      averageGuesses,
      bestGuessCount,
    };
  }

  async getForUser(userId: string, now: Date = new Date()): Promise<UserStatsResponse> {
    const results = await this.stats.aggregateOfficialForUser(userId);
    return aggregateUserStats(results, now, ACTIVITY_CALENDAR_START);
  }
}
