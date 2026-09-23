import type { ClientPuzzle, GameState, GameStatus, GuessResult } from "@redactle/shared";
import { GameStateSchema } from "@redactle/shared";
import { isInflectionalDuplicate } from "../inflection/expand-forms.js";
import { matchGuess } from "../matcher/matcher.js";
import { normalizeGuess } from "../normalizer/word-normalizer.js";

export interface GameEngine {
  getState(): GameState;
  getRevealedTokenIds(): Set<string>;
  getHitCounts(): Map<string, number>;
  guess(rawGuess: string): GuessResult;
  giveUp(): GameState;
  /** Explicit replay: new attemptId, cleared guesses, IN_PROGRESS. */
  replay(): GameState;
  serialize(): string;
  getProgress(): { revealedWords: number; totalRedactedWords: number };
  /** Progress from guesses only — ignores terminal reveal-all after win/give-up. */
  getGuessProgress(): { revealedWords: number; totalRedactedWords: number };
  getTitleDisplay(): string;
}

function newAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createInitialState(puzzleId: string, startedAt?: number, attemptId?: string): GameState {
  return {
    puzzleId,
    attemptId: attemptId ?? newAttemptId(),
    guesses: [],
    startedAt: startedAt ?? Date.now(),
    completedAt: null,
    status: "IN_PROGRESS",
  };
}

function revealFromGuesses(puzzle: ClientPuzzle, guesses: string[]): {
  revealed: Set<string>;
  hitCounts: Map<string, number>;
} {
  const revealed = new Set<string>();
  const hitCounts = new Map<string, number>();

  for (const guess of guesses) {
    const result = matchGuess(puzzle.content, guess);
    if (!result.normalizedGuess) continue;
    hitCounts.set(result.normalizedGuess, result.hitCount);
    for (const id of result.matchedTokenIds) {
      revealed.add(id);
    }
  }

  return { revealed, hitCounts };
}

function allTitleTokensRevealed(puzzle: ClientPuzzle, revealed: Set<string>): boolean {
  // An empty list means every title word is already visible (common words, or a
  // difficulty that opened them). Nothing remains to guess, so the case is solved.
  if (puzzle.titleTokenIds.length === 0) return true;
  return puzzle.titleTokenIds.every((tokenId) => revealed.has(tokenId));
}

/**
 * Create a deterministic game engine for a decoded client puzzle.
 *
 * Win condition (Phase 1.1): all title token IDs are revealed.
 */
export function createGame(puzzle: ClientPuzzle, initialState?: Partial<GameState>): GameEngine {
  let state: GameState = {
    ...createInitialState(puzzle.puzzleId, initialState?.startedAt, initialState?.attemptId),
    ...initialState,
    puzzleId: puzzle.puzzleId,
    attemptId: initialState?.attemptId ?? createInitialState(puzzle.puzzleId).attemptId,
  };

  if (state.puzzleId !== puzzle.puzzleId) {
    throw new Error("GameState puzzleId does not match the provided puzzle");
  }

  let { revealed, hitCounts } = revealFromGuesses(puzzle, state.guesses);

  // Derive WON from title tokens when restoring an in-progress attempt.
  if (state.status === "IN_PROGRESS" && allTitleTokensRevealed(puzzle, revealed)) {
    state = {
      ...state,
      status: "WON",
      completedAt: state.completedAt ?? Date.now(),
    };
  }

  // Terminal give-up / won: reveal everything for display when restoring.
  if (state.status === "GAVE_UP" || state.status === "WON") {
    for (const token of puzzle.content) {
      if (token.redacted) {
        revealed.add(token.tokenId);
      }
    }
  }

  function recompute(): void {
    const next = revealFromGuesses(puzzle, state.guesses);
    revealed = next.revealed;
    hitCounts = next.hitCounts;
  }

  return {
    getState() {
      return {
        ...state,
        guesses: [...state.guesses],
        completedAt: state.completedAt ?? null,
      };
    },

    getRevealedTokenIds() {
      return new Set(revealed);
    },

    getHitCounts() {
      return new Map(hitCounts);
    },

    getTitleDisplay() {
      return puzzle.title;
    },

    guess(rawGuess: string): GuessResult {
      if (state.status !== "IN_PROGRESS") {
        return {
          normalizedGuess: normalizeGuess(rawGuess) ?? "",
          hitCount: 0,
          matchedTokenIds: [],
          isCorrect: false,
          isDuplicate: false,
          gameCompleted: true,
          status: state.status,
        };
      }

      const normalized = normalizeGuess(rawGuess);
      if (!normalized) {
        return {
          normalizedGuess: "",
          hitCount: 0,
          matchedTokenIds: [],
          isCorrect: false,
          isDuplicate: false,
          gameCompleted: false,
          status: state.status,
        };
      }

      if (isInflectionalDuplicate(state.guesses, normalized)) {
        const priorMatch = matchGuess(puzzle.content, normalized);
        return {
          normalizedGuess: normalized,
          hitCount: priorMatch.hitCount,
          matchedTokenIds: [],
          isCorrect: false,
          isDuplicate: true,
          gameCompleted: false,
          status: state.status,
        };
      }

      const match = matchGuess(puzzle.content, normalized);
      state = {
        ...state,
        guesses: [...state.guesses, normalized],
      };
      recompute();

      let status: GameStatus = state.status;
      if (allTitleTokensRevealed(puzzle, revealed)) {
        status = "WON";
        state = {
          ...state,
          status,
          completedAt: Date.now(),
        };
        for (const token of puzzle.content) {
          if (token.redacted) revealed.add(token.tokenId);
        }
      }

      return {
        normalizedGuess: normalized,
        hitCount: match.hitCount,
        matchedTokenIds: match.matchedTokenIds,
        isCorrect: match.isCorrect,
        isDuplicate: false,
        gameCompleted: status !== "IN_PROGRESS",
        status,
      };
    },

    giveUp(): GameState {
      if (state.status !== "IN_PROGRESS") {
        return this.getState();
      }
      state = {
        ...state,
        status: "GAVE_UP",
        completedAt: Date.now(),
      };
      for (const token of puzzle.content) {
        if (token.redacted) {
          revealed.add(token.tokenId);
        }
      }
      return this.getState();
    },

    replay(): GameState {
      state = createInitialState(puzzle.puzzleId);
      recompute();
      return this.getState();
    },

    serialize(): string {
      return JSON.stringify(state);
    },

    getProgress() {
      return countProgress(puzzle, revealed);
    },

    getGuessProgress() {
      const guessed = revealFromGuesses(puzzle, state.guesses).revealed;
      return countProgress(puzzle, guessed);
    },
  };
}

function countProgress(
  puzzle: ClientPuzzle,
  revealedIds: Set<string>,
): { revealedWords: number; totalRedactedWords: number } {
  const totalRedactedWords = puzzle.content.filter((t) => t.type === "word" && t.redacted).length;
  const revealedWords = puzzle.content.filter(
    (t) => t.type === "word" && t.redacted && revealedIds.has(t.tokenId),
  ).length;
  return { revealedWords, totalRedactedWords };
}

export function deserializeGameState(serialized: string): GameState | null {
  try {
    const parsed: unknown = JSON.parse(serialized);
    const result = GameStateSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function restoreGame(puzzle: ClientPuzzle, state: GameState): GameEngine {
  return createGame(puzzle, state);
}
