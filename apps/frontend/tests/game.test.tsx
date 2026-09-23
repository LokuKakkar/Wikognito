import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDummyClientPuzzle } from "@redactle/test-utils";
import { GamePage } from "../components/GamePage";
import {
  HOWTO_STORAGE_KEY,
  LOCAL_STORAGE_GAME_KEY,
  PLAY_DIFFICULTY_STORAGE_KEY,
  emptyPuzzleStats,
  gameStorageKey,
} from "@redactle/shared";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
}));

const puzzle = createDummyClientPuzzle({
  puzzleId: "puzzle-test",
  puzzleNumber: 1,
  scheduledDate: "2026-08-13",
});

vi.mock("@/lib/api", () => ({
  fetchTodayPuzzle: vi.fn(async () => puzzle),
  fetchAdminArticlePuzzle: vi.fn(async () => puzzle),
  fetchCurrentSession: vi.fn(async () => undefined),
  syncSession: vi.fn(async () => ({})),
  completeGame: vi.fn(async () => ({
    id: "result-1",
    puzzleId: puzzle.puzzleId,
    attemptId: "attempt-1",
    attemptNumber: 1,
    isOfficial: true,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 1000,
    guessCount: 2,
    won: true,
    score: 980,
    scoreVersion: 1,
    hitGuessCount: 2,
    guessAccuracy: 1,
    status: "WON",
    source: "DAILY",
    puzzleStats: {
      ...emptyPuzzleStats(puzzle.puzzleId),
      gamesPlayed: 1,
      gamesWon: 1,
      medianGuessCount: 2,
      medianAccuracy: 1,
      medianDurationMs: 1000,
      guessHistogram: { "2": 1 },
    },
  })),
  fetchTodayLeaderboard: vi.fn(async () => ({
    puzzleNumber: 1,
    date: "2026-08-13",
    page: 1,
    pageSize: 20,
    total: 0,
    entries: [],
    authenticated: false,
    played: false,
    me: null,
  })),
  fetchStats: vi.fn(async () => ({
    gamesPlayed: 0,
    gamesWon: 0,
    gamesGaveUp: 0,
    averageGuesses: null,
    bestGuessCount: null,
  })),
  fetchMe: vi.fn(async () => null),
  googleAuthUrl: () => "http://localhost:4000/api/auth/google",
  logout: vi.fn(async () => ({ ok: true })),
  fetchUserStats: vi.fn(),
  fetchPuzzleStats: vi.fn(async () => emptyPuzzleStats("puzzle-test")),
  fetchArchivePuzzle: vi.fn(),
  resendVerification: vi.fn(),
}));

async function readyGame() {
  const user = userEvent.setup();
  render(<GamePage />);
  const howto = await screen.findByRole("button", { name: /continue|begin/i }).catch(() => null);
  if (howto) await user.click(howto);
  const begin = screen.queryByRole("button", { name: /begin/i });
  if (begin) await user.click(begin);
  const article = await screen.findByLabelText("Redacted article");
  const input = await screen.findByLabelText("Write a word");
  await waitFor(() => {
    expect(input).not.toBeDisabled();
  });
  return { article, input, user };
}

describe("GamePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(HOWTO_STORAGE_KEY, "1");
  });

  it("keeps a saved difficulty off the puzzle itself", async () => {
    window.localStorage.setItem(PLAY_DIFFICULTY_STORAGE_KEY, "hard");
    await readyGame();
    expect(screen.queryByRole("group", { name: "Difficulty" })).toBeNull();
    expect(window.localStorage.getItem(PLAY_DIFFICULTY_STORAGE_KEY)).toBe("hard");
  });

  it("renders the redacted puzzle", async () => {
    await readyGame();
    expect(document.querySelectorAll(".word.redacted").length).toBeGreaterThan(0);
    expect(document.querySelector(".title-strip")).toBeNull();
    expect(document.querySelector(".fog-bar")).toBeNull();
    expect(screen.getByText(/0 guesses/)).toBeInTheDocument();
    expect(screen.getByText(/start here/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in with Google" })).toBeInTheDocument();
  });

  it("reveals matching words on guess without needing a guess API", async () => {
    const user = userEvent.setup();
    const { input } = await readyGame();

    await user.type(input, "mathematician");
    await user.click(screen.getByRole("button", { name: "Guess" }));

    await waitFor(() => {
      expect(document.querySelector(".word.revealed")).toBeTruthy();
    });
    expect(screen.getByRole("status")).toHaveTextContent(/1 hit/i);
    expect(screen.getAllByText(/tap a recovered word/i).length).toBeGreaterThan(0);
  });

  it("shows duplicate guess feedback", async () => {
    const user = userEvent.setup();
    const { input } = await readyGame();

    await user.type(input, "english");
    await user.click(screen.getByRole("button", { name: "Guess" }));
    await user.type(input, "english");
    await user.click(screen.getByRole("button", { name: "Guess" }));

    await waitFor(() => {
      expect(screen.getByText(/already guessed/i)).toBeInTheDocument();
    });
  });

  it("wins when all title words are revealed", async () => {
    const user = userEvent.setup();
    const { input } = await readyGame();

    await user.type(input, "ada");
    await user.click(screen.getByRole("button", { name: "Guess" }));
    await user.type(input, "lovelace");
    await user.click(screen.getByRole("button", { name: "Guess" }));

    await waitFor(() => {
      expect(screen.getByText(/you solved it/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/case filed/i)).toBeInTheDocument();
    expect(document.querySelector(".case-stamp")).toBeTruthy();
    expect(screen.getAllByText("Ada Lovelace")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Replay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share Result" })).toBeInTheDocument();
    const modal = await waitFor(() => screen.getByRole("dialog", { name: "Solve stats" }), {
      timeout: 3500,
    });
    expect(modal).toHaveTextContent("Guesses");
    expect(modal).not.toHaveTextContent("Ada Lovelace");
  });

  it("restores localStorage terminal state on reload", async () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_GAME_KEY,
      JSON.stringify({
        puzzleId: puzzle.puzzleId,
        attemptId: "attempt-restore",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 10_000,
        completedAt: Date.now(),
        status: "WON",
      }),
    );

    render(<GamePage />);
    await waitFor(() => {
      expect(screen.getByText(/you solved it/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText("Ada Lovelace")).toHaveLength(1);
  });

  it("shows how-to once and hides CaseIntro after guesses exist", async () => {
    window.localStorage.removeItem(HOWTO_STORAGE_KEY);
    const user = userEvent.setup();
    render(<GamePage />);
    expect(await screen.findByRole("heading", { name: /how a case is solved/i })).toBeInTheDocument();
    expect(screen.getByText(/change it in settings/i)).toBeInTheDocument();
    expect(screen.getByText("Write a word")).toBeInTheDocument();
    expect(screen.getByText("Tap a correct guess")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(window.localStorage.getItem(HOWTO_STORAGE_KEY)).toBe("1");
    expect(await screen.findByRole("heading", { name: /puzzle #1/i })).toBeInTheDocument();
    expect(screen.getByText("Tap a hit")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /begin/i }));
    expect(screen.getByLabelText("Redacted article")).toBeInTheDocument();
  });

  it("toggles letter count on the redacted span independently", async () => {
    const user = userEvent.setup();
    await readyGame();
    const redacted = [...document.querySelectorAll(".word.redacted")] as HTMLElement[];
    expect(redacted.length).toBeGreaterThan(1);
    expect(redacted[0].getAttribute("title")).toBeNull();

    await user.click(redacted[0]);
    expect(redacted[0].querySelector(".letter-count")).toHaveTextContent(String(redacted[0].dataset.wordLength));
    expect(redacted[1].querySelector(".letter-count")).toBeNull();

    await user.click(redacted[1]);
    expect(redacted[0].querySelector(".letter-count")).toBeTruthy();
    expect(redacted[1].querySelector(".letter-count")).toHaveTextContent(String(redacted[1].dataset.wordLength));

    await user.click(redacted[0]);
    expect(redacted[0].querySelector(".letter-count")).toBeNull();
    expect(redacted[1].querySelector(".letter-count")).toBeTruthy();
  });

  it("replay resets to a new in-progress attempt", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      LOCAL_STORAGE_GAME_KEY,
      JSON.stringify({
        puzzleId: puzzle.puzzleId,
        attemptId: "attempt-old",
        guesses: ["ada", "lovelace"],
        startedAt: Date.now() - 10_000,
        completedAt: Date.now(),
        status: "WON",
      }),
    );

    render(<GamePage />);
    await waitFor(() => screen.getByRole("button", { name: "Replay" }));
    await user.click(screen.getByRole("button", { name: "Replay" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Write a word")).not.toBeDisabled();
    });
    const stored = JSON.parse(window.localStorage.getItem(gameStorageKey(puzzle.puzzleId))!) as {
      attemptId: string;
      status: string;
      guesses: string[];
    };
    expect(stored.status).toBe("IN_PROGRESS");
    expect(stored.attemptId).not.toBe("attempt-old");
    expect(stored.guesses).toEqual([]);
    expect(screen.getAllByText(/notes land here/i).length).toBeGreaterThan(0);
  });

  it("shares a result without revealing the answer", async () => {
    const user = userEvent.setup();
    const { input } = await readyGame();
    await user.type(input, "ada");
    await user.click(screen.getByRole("button", { name: "Guess" }));
    await user.type(input, "lovelace");
    await user.click(screen.getByRole("button", { name: "Guess" }));
    await waitFor(() => screen.getByRole("button", { name: "Share Result" }));
    await user.click(screen.getByRole("button", { name: "Share Result" }));
    expect(screen.getByRole("dialog", { name: "Share your result" })).toBeInTheDocument();
    const preview = screen.getByText(/WIKOGNITO #1/).textContent ?? "";
    expect(preview).toContain("Won");
    expect(preview).toContain("guesses");
    expect(preview).not.toContain("Ada Lovelace");
    expect(preview).not.toContain("lovelace");
    expect(preview).toContain("puzzle-test");
  });
});
