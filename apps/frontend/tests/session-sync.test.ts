import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { GameState } from "@redactle/shared";
import { syncSession } from "@/lib/api";
import { SYNC_DEBOUNCE_MS, SYNC_INTERVAL_MS, useSessionSync } from "../features/game/useSessionSync";

vi.mock("@/lib/api", () => ({
  syncSession: vi.fn(async () => ({})),
}));

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    puzzleId: "puzzle-1",
    attemptId: "attempt-1",
    status: "IN_PROGRESS",
    guesses: [],
    startedAt: 1_000,
    completedAt: null,
    ...overrides,
  };
}

describe("useSessionSync", () => {
  beforeEach(() => {
    vi.mocked(syncSession).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a 5-minute interval and 30-second guess debounce", () => {
    expect(SYNC_INTERVAL_MS).toBe(5 * 60_000);
    expect(SYNC_DEBOUNCE_MS).toBe(30_000);
  });

  it("debounces in-progress guess syncs and pushes immediately on a win", async () => {
    const { rerender } = renderHook(
      ({ game }: { game: GameState }) => useSessionSync(game, true),
      { initialProps: { game: state() } },
    );
    expect(syncSession).toHaveBeenCalledTimes(1);

    rerender({ game: state({ guesses: ["ada"] }) });
    expect(syncSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS - 1);
    });
    expect(syncSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(syncSession).toHaveBeenCalledTimes(2);

    rerender({
      game: state({ guesses: ["ada"], status: "WON", completedAt: 2_000 }),
    });
    expect(syncSession).toHaveBeenCalledTimes(3);
  });

  it("pushes immediately when the tab hides", () => {
    renderHook(() => useSessionSync(state({ guesses: ["ada"] }), true));
    expect(syncSession).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(syncSession).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });
});
