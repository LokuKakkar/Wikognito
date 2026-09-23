"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LOCAL_STORAGE_GAME_KEY,
  gameStorageKey,
  type ClientPuzzle,
  type GameResultResponse,
  type GameState,
  type GuessResult,
  type StatsResponse,
} from "@redactle/shared";
import { createGame, type GameEngine } from "@redactle/puzzle-engine";
import { completeGame, fetchCurrentSession, fetchStats } from "@/lib/api";
import { loadGameStateForPuzzle, saveLocalGameState } from "@/lib/local-storage";
import { useSessionSync } from "./useSessionSync";

const EMPTY_PROGRESS = { revealedWords: 0, totalRedactedWords: 0 };

export interface UseGameOptions {
  /** When false, skip Redis session, game completion, and official stats. */
  persistRemote?: boolean;
  storageKey?: string;
}

export interface UseGameResult {
  state: GameState | null;
  revealedTokenIds: Set<string>;
  hitCounts: Map<string, number>;
  lastResult: GuessResult | null;
  progress: { revealedWords: number; totalRedactedWords: number };
  guessProgress: { revealedWords: number; totalRedactedWords: number };
  stats: StatsResponse | null;
  ready: boolean;
  title: string;
  completion: GameResultResponse | null;
  submitGuess: (guess: string) => GuessResult | null;
  giveUp: () => Promise<void>;
  replay: () => void;
  displayValueForToken: (tokenId: string) => string | undefined;
}

/**
 * Recovery order:
 * 1. localStorage for same puzzleId (including terminal WON/GAVE_UP)
 * 2. Redis session recovery
 * 3. Fresh game
 *
 * Terminal state is never auto-reset — only explicit replay starts a new attempt.
 */
export function useGame(puzzle: ClientPuzzle | null, options: UseGameOptions = {}): UseGameResult {
  const persistRemote = options.persistRemote ?? true;
  const storageKey = options.storageKey ?? (puzzle ? gameStorageKey(puzzle.puzzleId) : LOCAL_STORAGE_GAME_KEY);

  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [revealedTokenIds, setRevealedTokenIds] = useState<Set<string>>(new Set());
  const [hitCounts, setHitCounts] = useState<Map<string, number>>(new Map());
  const [lastResult, setLastResult] = useState<GuessResult | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [completion, setCompletion] = useState<GameResultResponse | null>(null);
  const [ready, setReady] = useState(false);

  const refreshFromEngine = useCallback(
    (game: GameEngine) => {
      const next = game.getState();
      setState(next);
      setRevealedTokenIds(game.getRevealedTokenIds());
      setHitCounts(game.getHitCounts());
      saveLocalGameState(next, storageKey);
    },
    [storageKey],
  );

  useEffect(() => {
    if (!puzzle) return;
    let cancelled = false;

    (async () => {
      const local = loadGameStateForPuzzle(puzzle.puzzleId, storageKey);
      if (local && local.puzzleId === puzzle.puzzleId) {
        const game = createGame(puzzle, local);
        if (!cancelled) {
          setEngine(game);
          refreshFromEngine(game);
          setReady(true);
        }
        return;
      }

      if (persistRemote) {
        try {
          const session = await fetchCurrentSession();
          if (session && session.puzzleId === puzzle.puzzleId && !cancelled) {
            const game = createGame(puzzle, {
              puzzleId: session.puzzleId,
              attemptId: session.attemptId,
              guesses: session.guesses,
              startedAt: session.startedAt,
              completedAt: session.completedAt ?? null,
              status: session.status,
            });
            setEngine(game);
            refreshFromEngine(game);
            setReady(true);
            return;
          }
        } catch {
          // Fall through to new game.
        }
      }

      if (!cancelled) {
        const game = createGame(puzzle);
        setEngine(game);
        refreshFromEngine(game);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [puzzle, persistRemote, refreshFromEngine, storageKey]);

  // Sync active and terminal state so completed games survive browser reopen.
  useSessionSync(state, ready && persistRemote);

  useEffect(() => {
    if (!persistRemote) {
      setStats(null);
      return;
    }
    void fetchStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [persistRemote, state?.status, state?.attemptId]);

  const persistCompletion = useCallback(
    async (gameState: GameState) => {
      if (!persistRemote || gameState.status === "IN_PROGRESS" || !puzzle) return;
      const result = await completeGame({
        puzzleId: puzzle.puzzleId,
        attemptId: gameState.attemptId,
        status: gameState.status,
        guesses: gameState.guesses,
        startedAt: gameState.startedAt,
        completedAt: gameState.completedAt ?? Date.now(),
      });
      setCompletion(result);
      const nextStats = await fetchStats();
      setStats(nextStats);
    },
    [persistRemote, puzzle],
  );

  const submitGuess = useCallback(
    (guess: string): GuessResult | null => {
      if (!engine) return null;
      const result = engine.guess(guess);
      setLastResult(result);
      refreshFromEngine(engine);
      if (result.gameCompleted) {
        void persistCompletion(engine.getState());
      }
      return result;
    },
    [engine, persistCompletion, refreshFromEngine],
  );

  const giveUp = useCallback(async () => {
    if (!engine) return;
    const next = engine.giveUp();
    setLastResult(null);
    refreshFromEngine(engine);
    await persistCompletion(next);
  }, [engine, persistCompletion, refreshFromEngine]);

  const replay = useCallback(() => {
    if (!engine) return;
    setLastResult(null);
    setCompletion(null);
    engine.replay();
    refreshFromEngine(engine);
  }, [engine, refreshFromEngine]);

  const progress = useMemo(() => {
    if (!engine) return EMPTY_PROGRESS;
    return engine.getProgress();
  }, [engine, revealedTokenIds]);

  const guessProgress = useMemo(() => {
    if (!engine) return EMPTY_PROGRESS;
    return engine.getGuessProgress();
  }, [engine, state?.guesses, revealedTokenIds]);

  const displayValueForToken = useCallback(
    (tokenId: string): string | undefined => {
      if (!puzzle || !revealedTokenIds.has(tokenId)) return undefined;
      const token = puzzle.content.find((t) => t.tokenId === tokenId);
      return token?.displayValue ?? token?.matchKey;
    },
    [puzzle, revealedTokenIds],
  );
  return {
    state,
    revealedTokenIds,
    hitCounts,
    lastResult,
    progress,
    guessProgress,
    stats,
    ready,
    completion,
    title: puzzle?.title ?? engine?.getTitleDisplay() ?? "",
    submitGuess,
    giveUp,
    replay,
    displayValueForToken,
  };
}
