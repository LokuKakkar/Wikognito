import { describe, expect, it } from "vitest";
import {
  aggregateUserStats,
  buildActivity,
  calendarStartFromFirstDaily,
  computeStreaks,
} from "./stats.service.js";
import type { OfficialUserResult } from "./stats.repository.js";

function result(overrides: Partial<OfficialUserResult> & { day: string }): OfficialUserResult {
  return {
    won: true,
    status: "WON",
    guessCount: 10,
    durationMs: 60_000,
    hitGuessCount: 8,
    completedAt: new Date(`${overrides.day}T12:00:00.000Z`),
    dailyDate: new Date(`${overrides.day}T00:00:00.000Z`),
    source: "DAILY",
    puzzleNumber: 1,
    ...overrides,
  };
}

describe("user statistics", () => {
  it("computes the required numeric fixture", () => {
    const stats = aggregateUserStats(
      [
        result({ day: "2026-08-01", guessCount: 30, durationMs: 120_000 }),
        result({ day: "2026-08-02", guessCount: 25, durationMs: 90_000 }),
        result({ day: "2026-08-03", won: false, status: "GAVE_UP", guessCount: 40, durationMs: 10_000 }),
      ],
      new Date("2026-08-03T12:00:00.000Z"),
    );

    expect(stats.gamesPlayed).toBe(3);
    expect(stats.gamesWon).toBe(2);
    expect(stats.gamesGaveUp).toBe(1);
    expect(stats.winRate).toBeCloseTo(2 / 3);
    expect(stats.averageGuesses).toBe(27.5);
    expect(stats.averageCompletionTimeMs).toBe(105_000);
  });

  it("returns safe zeros and nulls with no games", () => {
    const stats = aggregateUserStats([], new Date("2026-08-03T12:00:00.000Z"));
    expect(stats.gamesPlayed).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.averageGuesses).toBeNull();
    expect(stats.averageCompletionTimeMs).toBeNull();
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(0);
    expect(stats.calendarStart).toBe("2026-07-01");
  });

  it("uses the fixed July 2026 calendar start", () => {
    expect(calendarStartFromFirstDaily(new Date("2026-08-21T00:00:00.000Z"))).toBe("2026-07-01");
    expect(calendarStartFromFirstDaily(null, new Date("2026-08-21T12:00:00.000Z"))).toBe("2026-07-01");
  });

  it("counts three consecutive wins", () => {
    const { currentStreak, longestStreak } = computeStreaks(
      [
        result({ day: "2026-08-18" }),
        result({ day: "2026-08-19" }),
        result({ day: "2026-08-20" }),
      ],
      new Date("2026-08-20T12:00:00.000Z"),
    );
    expect(currentStreak).toBe(3);
    expect(longestStreak).toBe(3);
  });

  it("breaks current streak on give up and keeps longest", () => {
    const { currentStreak, longestStreak } = computeStreaks(
      [
        result({ day: "2026-08-18" }),
        result({ day: "2026-08-19" }),
        result({ day: "2026-08-20" }),
        result({ day: "2026-08-21", won: false, status: "GAVE_UP" }),
        result({ day: "2026-08-22" }),
      ],
      new Date("2026-08-22T12:00:00.000Z"),
    );
    expect(currentStreak).toBe(1);
    expect(longestStreak).toBe(3);
  });

  it("breaks streak on a missing day", () => {
    const { currentStreak, longestStreak } = computeStreaks(
      [result({ day: "2026-08-18" }), result({ day: "2026-08-20" })],
      new Date("2026-08-20T12:00:00.000Z"),
    );
    expect(currentStreak).toBe(1);
    expect(longestStreak).toBe(1);
  });

  it("keeps current streak when today is not yet played after a yesterday win", () => {
    const { currentStreak } = computeStreaks(
      [result({ day: "2026-08-19" }), result({ day: "2026-08-20" })],
      new Date("2026-08-21T12:00:00.000Z"),
    );
    expect(currentStreak).toBe(2);
  });

  it("clears current streak when the last win is older than yesterday", () => {
    const { currentStreak, longestStreak } = computeStreaks(
      [result({ day: "2026-08-18" })],
      new Date("2026-08-21T12:00:00.000Z"),
    );
    expect(currentStreak).toBe(0);
    expect(longestStreak).toBe(1);
  });

  it("ignores archive official wins for streak but counts them in general stats", () => {
    const stats = aggregateUserStats(
      [
        result({ day: "2026-08-18" }),
        result({ day: "2026-08-19" }),
        result({
          day: "2026-08-17",
          source: "ARCHIVE",
          guessCount: 40,
          durationMs: 80_000,
        }),
        result({ day: "2026-08-20" }),
      ],
      new Date("2026-08-20T12:00:00.000Z"),
    );
    expect(stats.gamesPlayed).toBe(4);
    expect(stats.gamesWon).toBe(4);
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it("activates the calendar only for official daily results", () => {
    const activity = buildActivity(
      [
        result({ day: "2026-08-20", puzzleNumber: 183 }),
        result({ day: "2026-08-19", won: false, status: "GAVE_UP", puzzleNumber: 182 }),
        result({ day: "2026-08-18", source: "ARCHIVE", puzzleNumber: 10 }),
      ],
      new Date("2026-08-21T12:00:00.000Z"),
    );
    expect(activity.map((day) => day.date)).toEqual(["2026-08-19", "2026-08-20"]);
    expect(activity.find((day) => day.date === "2026-08-20")?.status).toBe("WON");
    expect(activity.find((day) => day.date === "2026-08-19")?.status).toBe("GAVE_UP");
  });

  it("does not include daily results before calendarStart", () => {
    const activity = buildActivity(
      [
        result({ day: "2026-01-01", puzzleNumber: 1 }),
        result({ day: "2026-08-20", puzzleNumber: 183 }),
        result({ day: "2026-08-18", source: "ARCHIVE", puzzleNumber: 10 }),
      ],
      new Date("2026-08-21T12:00:00.000Z"),
      "2026-07-22",
    );
    expect(activity.map((day) => day.date)).toEqual(["2026-08-20"]);
  });

  it("does not let an archive win stand in for a missed daily day", () => {
    const { currentStreak, longestStreak } = computeStreaks(
      [
        result({ day: "2026-08-18" }),
        result({ day: "2026-08-19" }),
        result({ day: "2026-08-20", source: "ARCHIVE" }),
      ],
      new Date("2026-08-20T12:00:00.000Z"),
    );
    expect(currentStreak).toBe(2);
    expect(longestStreak).toBe(2);
  });
});
