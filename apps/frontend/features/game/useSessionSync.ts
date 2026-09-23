"use client";

import { useEffect, useRef } from "react";
import type { GameState } from "@redactle/shared";
import { syncSession } from "@/lib/api";

export const SYNC_INTERVAL_MS = 5 * 60_000;
export const SYNC_DEBOUNCE_MS = 30_000;

function pushSession(state: GameState | null): void {
  if (!state) return;
  void syncSession({
    puzzleId: state.puzzleId,
    attemptId: state.attemptId,
    status: state.status,
    guesses: state.guesses,
    startedAt: state.startedAt,
    completedAt: state.completedAt ?? null,
  }).catch(() => {
    // Sync failures are non-fatal for gameplay; localStorage remains source of truth.
  });
}

/**
 * Periodically sync active/terminal game state to Redis via the backend.
 * Does NOT process guesses — only persists browser-authoritative state.
 * Terminal WON/GAVE_UP state is kept so reload can recover completed games.
 *
 * In-progress guess changes debounce (~30s). Interval is 5 minutes.
 * Terminal status and tab hide still push immediately.
 */
export function useSessionSync(state: GameState | null, enabled: boolean): void {
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    if (!enabled || !state) return;

    const push = () => pushSession(latest.current);

    push();
    const interval = window.setInterval(push, SYNC_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        push();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, state?.puzzleId, state?.attemptId, state?.status, state?.completedAt]);

  useEffect(() => {
    if (!enabled || !state || state.status !== "IN_PROGRESS") return;
    const timeout = window.setTimeout(() => pushSession(latest.current), SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [enabled, state?.puzzleId, state?.attemptId, state?.status, state?.guesses.length]);
}
