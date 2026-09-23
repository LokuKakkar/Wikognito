import { DIFFICULTY_VERSION } from "@redactle/shared";

export interface DifficultyInput {
  uniqueGuessableWordCount: number;
  guessableWordCount: number;
  titleTokenCount: number;
}

export interface DifficultyResult {
  difficultyValue: number;
  difficultyVersion: number;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function normalizeRange(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

/**
 * Deterministic difficulty v1 from stored puzzle metrics. Range 1–100.
 */
export function computeDifficultyV1(input: DifficultyInput): DifficultyResult {
  const raw =
    0.6 * normalizeRange(input.uniqueGuessableWordCount, 80, 500) +
    0.25 * normalizeRange(input.guessableWordCount, 300, 2500) +
    0.15 * normalizeRange(input.titleTokenCount, 1, 5);
  const difficultyValue = Math.round(1 + raw * 99);
  return {
    difficultyValue: Math.min(100, Math.max(1, difficultyValue)),
    difficultyVersion: DIFFICULTY_VERSION,
  };
}
