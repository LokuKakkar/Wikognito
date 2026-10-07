import { describe, expect, it } from "vitest";
import {
  CROWD_MAX_PER_DAY,
  CROWD_MIN_PER_DAY,
  CROWD_PLAYERS,
  crowdPlaysForDate,
  playersForDate,
} from "./crowd-roster.js";

function dateKey(dayOffset: number): string {
  const date = new Date(Date.UTC(2026, 0, 1 + dayOffset));
  return date.toISOString().slice(0, 10);
}

describe("crowd roster", () => {
  it("keeps twenty distinct gmail accounts", () => {
    expect(CROWD_PLAYERS).toHaveLength(20);
    const emails = new Set(CROWD_PLAYERS.map((player) => player.email));
    const names = new Set(CROWD_PLAYERS.map((player) => player.displayName));
    expect(emails.size).toBe(20);
    expect(names.size).toBe(20);
    for (const player of CROWD_PLAYERS) {
      expect(player.email.endsWith("@gmail.com")).toBe(true);
    }
  });

  it("sends a different subset each day and never the whole crowd", () => {
    const days = Array.from({ length: 21 }, (_, index) => playersForDate(dateKey(index)));
    for (const playing of days) {
      expect(playing.length).toBeGreaterThanOrEqual(CROWD_MIN_PER_DAY);
      expect(playing.length).toBeLessThanOrEqual(CROWD_MAX_PER_DAY);
      expect(playing.length).toBeLessThan(CROWD_PLAYERS.length);
    }

    const missed = CROWD_PLAYERS.filter((player) =>
      days.some((playing) => !playing.some((entry) => entry.id === player.id)),
    );
    expect(missed).toHaveLength(CROWD_PLAYERS.length);

    const appeared = new Set(days.flat().map((player) => player.id));
    expect(appeared.size).toBe(CROWD_PLAYERS.length);
    expect(playersForDate("2026-04-02").map((player) => player.id)).toEqual(
      playersForDate("2026-04-02").map((player) => player.id),
    );
  });

  it("scores a spread of guess counts and accuracies with the real formula", () => {
    const now = new Date("2026-04-02T18:00:00.000Z");
    const plays = crowdPlaysForDate("2026-04-02", 55, now);
    const scores = plays.map((play) => play.score);
    const guesses = plays.map((play) => play.guessCount);

    const again = crowdPlaysForDate("2026-04-02", 55, now);
    expect(again.map((play) => [play.guessCount, play.hitGuessCount, play.durationMs, play.score])).toEqual(
      plays.map((play) => [play.guessCount, play.hitGuessCount, play.durationMs, play.score]),
    );
    const otherDay = crowdPlaysForDate("2026-08-19", 55, new Date("2026-08-19T18:00:00.000Z"));
    expect(otherDay.map((play) => play.guessCount).join(",")).not.toBe(guesses.join(","));

    expect(plays.length).toBeGreaterThanOrEqual(CROWD_MIN_PER_DAY);
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(1500);
    expect(new Set(guesses).size).toBeGreaterThan(8);
    for (const play of plays) {
      expect(play.scoreVersion).toBe(1);
      expect(play.score).toBeGreaterThan(0);
      expect(play.score).toBeLessThanOrEqual(10_000);
      expect(play.hitGuessCount).toBeGreaterThan(0);
      expect(play.hitGuessCount).toBeLessThanOrEqual(play.guessCount);
      expect(play.guessCount).toBeLessThanOrEqual(40);
      expect(play.completedAt.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(play.completedAt.toISOString().startsWith("2026-04-02")).toBe(true);
      const accuracy = play.hitGuessCount / play.guessCount;
      expect(accuracy).toBeGreaterThan(0.2);
      expect(accuracy).toBeLessThanOrEqual(1);
    }
  });
});
