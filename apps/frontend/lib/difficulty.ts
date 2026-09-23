import {
  DEFAULT_PLAY_DIFFICULTY,
  PLAY_DIFFICULTY_STORAGE_KEY,
  isPlayDifficulty,
  type PlayDifficulty,
} from "@redactle/shared";

export function readPlayDifficulty(): PlayDifficulty {
  if (typeof window === "undefined") return DEFAULT_PLAY_DIFFICULTY;
  try {
    const stored = window.localStorage.getItem(PLAY_DIFFICULTY_STORAGE_KEY);
    return isPlayDifficulty(stored) ? stored : DEFAULT_PLAY_DIFFICULTY;
  } catch {
    return DEFAULT_PLAY_DIFFICULTY;
  }
}

export function writePlayDifficulty(difficulty: PlayDifficulty): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAY_DIFFICULTY_STORAGE_KEY, difficulty);
  } catch {
    // Persistence is optional if storage is unavailable.
  }
}
