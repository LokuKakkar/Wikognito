import { calculateScoreV1, computeDifficultyV1 } from "@redactle/puzzle-engine";
import seedrandom from "seedrandom";

/** Enough finishes for a full board, and never the whole crowd on the same day. */
export const CROWD_MIN_PER_DAY = 12;
export const CROWD_MAX_PER_DAY = 18;
export const CROWD_PASSWORD = "password";

export interface CrowdPlayer {
  id: string;
  email: string;
  displayName: string;
  sessionId: string;
}

export interface CrowdPlay {
  player: CrowdPlayer;
  guessCount: number;
  hitGuessCount: number;
  durationMs: number;
  score: number;
  scoreVersion: number;
  startedAt: Date;
  completedAt: Date;
}

interface PuzzleDifficultyFields {
  difficultyValue: number;
  difficultyVersion: number;
  uniqueGuessableWordCount: number;
  guessableWordCount: number;
  titleTokenCount: number;
}

export const CROWD_PLAYERS: CrowdPlayer[] = [
  person("aarav", "Aarav", "aarav.wikognito"),
  person("ananya", "Ananya", "ananya.wikognito"),
  person("kabir", "Kabir", "kabir.wikognito"),
  person("diya", "Diya", "diya.wikognito"),
  person("ishaan", "Ishaan", "ishaan.wikognito"),
  person("neha", "Neha", "neha.wikognito"),
  person("rohan", "Rohan", "rohan.wikognito"),
  person("kavya", "Kavya", "kavya.wikognito"),
  person("aditya", "Aditya", "aditya.wikognito"),
  person("tanvi", "Tanvi", "tanvi.wikognito"),
  person("vivaan", "Vivaan", "vivaan.wikognito"),
  person("meera", "Meera", "meera.wikognito"),
  person("footnote-12", "Footnote 12", "footnote12.wikognito"),
  person("guessed-the-capital", "Guessed the Capital", "guessed.the.capital"),
  person("only-abstracts", "Only Abstracts", "only.abstracts"),
  person("title-was-obvious", "Title Was Obvious", "title.was.obvious"),
  person("second-paragraph", "Second Paragraph", "second.paragraph"),
  person("almost-the-composer", "Almost the Composer", "almost.the.composer"),
  person("page-47", "Page 47", "page47.wikognito"),
  person("ctrl-f", "Ctrl+F", "ctrl.f.wikognito"),
];

function person(slug: string, displayName: string, mailbox: string): CrowdPlayer {
  return {
    id: `crowd-${slug}`,
    email: `${mailbox}@gmail.com`,
    displayName,
    sessionId: `session-crowd-${slug}`,
  };
}

export function hash32(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Stable subset for a UTC date. Same date always picks the same players. */
export function playersForDate(dateKey: string): CrowdPlayer[] {
  const ranked = [...CROWD_PLAYERS].sort(
    (left, right) => hash32(`${dateKey}:attend:${left.id}`) - hash32(`${dateKey}:attend:${right.id}`),
  );
  const span = CROWD_MAX_PER_DAY - CROWD_MIN_PER_DAY + 1;
  const count = CROWD_MIN_PER_DAY + (hash32(`${dateKey}:count`) % span);
  return ranked.slice(0, count);
}

export function difficultyForPuzzle(puzzle: PuzzleDifficultyFields): number {
  if (puzzle.difficultyVersion === 1 && puzzle.difficultyValue > 0) {
    return puzzle.difficultyValue;
  }
  return computeDifficultyV1({
    uniqueGuessableWordCount: puzzle.uniqueGuessableWordCount,
    guessableWordCount: puzzle.guessableWordCount,
    titleTokenCount: puzzle.titleTokenCount,
  }).difficultyValue;
}

export function crowdCompletedAt(dateKey: string, playerId: string, now: Date): Date {
  const dayStart = Date.parse(`${dateKey}T00:00:00.000Z`);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1000;
  const latest = Math.min(dayEnd, now.getTime() - 1000);
  if (latest <= dayStart) return new Date(dayStart);
  const offset = hash32(`${dateKey}:done:${playerId}`) % (latest - dayStart);
  return new Date(dayStart + offset);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Seeded draw so the same player and day always file the same finish. */
function randomPerformance(dateKey: string, playerId: string): {
  guessCount: number;
  hitGuessCount: number;
  durationMs: number;
} {
  const random = seedrandom(`${dateKey}:${playerId}`);
  const guessCount = 4 + Math.floor(random() * 37);
  const accuracy = 0.3 + random() * 0.65;
  const hitGuessCount = clamp(Math.round(guessCount * accuracy), 1, guessCount);
  const durationMs = 60_000 + Math.floor(random() * 17 * 60_000);
  return { guessCount, hitGuessCount, durationMs };
}

/**
 * One official daily finish. Guess count, accuracy, and time come from a seeded
 * random draw. Score is the same v1 formula real solves use.
 */
export function crowdPlaysForDate(dateKey: string, difficultyValue: number, now: Date): CrowdPlay[] {
  return playersForDate(dateKey).map((player) => {
    const performance = randomPerformance(dateKey, player.id);
    const completedAt = crowdCompletedAt(dateKey, player.id, now);
    const startedAt = new Date(completedAt.getTime() - performance.durationMs);
    const scored = calculateScoreV1({
      guessCount: performance.guessCount,
      durationMs: performance.durationMs,
      hitGuessCount: performance.hitGuessCount,
      difficultyValue,
    });
    return {
      player,
      guessCount: performance.guessCount,
      hitGuessCount: performance.hitGuessCount,
      durationMs: performance.durationMs,
      score: scored.score,
      scoreVersion: scored.scoreVersion,
      startedAt,
      completedAt,
    };
  });
}
