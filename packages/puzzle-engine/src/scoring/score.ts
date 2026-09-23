import {
  DIFFICULTY_FACTOR_MIN,
  DIFFICULTY_FACTOR_SPAN,
  SCORE_MAX,
  SCORE_MIN,
  SCORE_VERSION,
  SCORE_WEIGHT_ACCURACY,
  SCORE_WEIGHT_GUESS,
  SCORE_WEIGHT_TIME,
} from "@redactle/shared";
import { guessAccuracy } from "../game/hit-guesses.js";

export interface ScoreInput {
  guessCount: number;
  durationMs: number;
  hitGuessCount: number;
  difficultyValue: number;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function guessEfficiency(guessCount: number, difficultyValue: number): number {
  const expectedGuesses = 20 + (difficultyValue / 100) * 80;
  const guesses = Math.max(1, guessCount);
  const logMin = Math.log(1);
  const logMax = Math.log(Math.max(expectedGuesses * 5, Math.E));
  return clamp01(1 - (Math.log(guesses) - logMin) / (logMax - logMin));
}

export function timeEfficiency(durationMs: number, difficultyValue: number): number {
  const expectedSeconds = 180 + (difficultyValue / 100) * 720;
  const durationSec = Math.max(0, durationMs / 1000);
  return clamp01(1 - durationSec / (expectedSeconds * 4));
}

export function difficultyFactor(difficultyValue: number): number {
  const difficulty = clamp(difficultyValue, 1, 100);
  return DIFFICULTY_FACTOR_MIN + DIFFICULTY_FACTOR_SPAN * (difficulty / 100);
}

/**
 * Difficulty-normalized competitive score v1. Pure and deterministic.
 */
export function calculateScoreV1(input: ScoreInput): { score: number; scoreVersion: number } {
  const difficultyValue = clamp(input.difficultyValue, 1, 100);
  const accuracy = guessAccuracy(input.hitGuessCount, input.guessCount) ?? 0;
  const performance =
    SCORE_WEIGHT_GUESS * guessEfficiency(input.guessCount, difficultyValue) +
    SCORE_WEIGHT_TIME * timeEfficiency(input.durationMs, difficultyValue) +
    SCORE_WEIGHT_ACCURACY * clamp01(accuracy);
  const score = Math.round(clamp(performance * difficultyFactor(difficultyValue) * SCORE_MAX, SCORE_MIN, SCORE_MAX));
  return { score, scoreVersion: SCORE_VERSION };
}
