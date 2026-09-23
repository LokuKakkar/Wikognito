import { GameStateSchema, LOCAL_STORAGE_GAME_KEY, gameStorageKey, type GameState } from "@redactle/shared";

/**
 * localStorage (not sessionStorage) so progress survives closing the browser.
 * Store compact GameState only — UI is always derived from Puzzle + GameState.
 * Keys are per-puzzle so archive play cannot overwrite today's attempt.
 */
export function loadLocalGameState(storageKey = LOCAL_STORAGE_GAME_KEY): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const result = GameStateSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function loadGameStateForPuzzle(puzzleId: string, storageKey?: string): GameState | null {
  const primary = loadLocalGameState(storageKey ?? gameStorageKey(puzzleId));
  if (primary?.puzzleId === puzzleId) return primary;
  const legacy = loadLocalGameState(LOCAL_STORAGE_GAME_KEY);
  return legacy?.puzzleId === puzzleId ? legacy : null;
}

export function saveLocalGameState(state: GameState, storageKey = LOCAL_STORAGE_GAME_KEY): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function clearLocalGameState(storageKey = LOCAL_STORAGE_GAME_KEY): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
