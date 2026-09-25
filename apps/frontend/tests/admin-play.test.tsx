import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDummyClientPuzzle } from "@redactle/test-utils";
import { LOCAL_STORAGE_ADMIN_PLAY_KEY, LOCAL_STORAGE_GAME_KEY } from "@redactle/shared";
import { GamePage } from "../components/GamePage";
import { AdminPlayPickerPage } from "../components/admin/AdminPlayPickerPage";
import {
  completeGame,
  fetchAdminArticles,
  fetchCurrentSession,
  fetchStats,
  fetchTodayPuzzle,
} from "@/lib/api";

const puzzle = createDummyClientPuzzle({
  puzzleId: "admin-play-article-pet",
  puzzleNumber: 0,
  scheduledDate: "2026-08-13",
});

const fetchAdminArticlePuzzle = vi.fn(async (_articleId: string) => puzzle);
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/play/article-pet",
}));

vi.mock("@/lib/api", () => ({
  fetchTodayPuzzle: vi.fn(async () => {
    throw new Error("today puzzle should not load during admin play");
  }),
  fetchAdminArticlePuzzle: (articleId: string) => fetchAdminArticlePuzzle(articleId),
  fetchCurrentSession: vi.fn(async () => undefined),
  syncSession: vi.fn(async () => ({})),
  completeGame: vi.fn(async () => ({})),
  fetchStats: vi.fn(async () => ({
    gamesPlayed: 0,
    gamesWon: 0,
    gamesGaveUp: 0,
    averageGuesses: null,
    bestGuessCount: null,
  })),
  fetchMe: vi.fn(async () => null),
  fetchUserStats: vi.fn(),
  fetchPuzzleStats: vi.fn(async () => ({
    puzzleId: "admin-play-article-pet",
    gamesPlayed: 0,
    gamesWon: 0,
    gamesGaveUp: 0,
    medianGuessCount: null,
    medianAccuracy: null,
    medianDurationMs: null,
    guessHistogram: {},
  })),
  googleAuthUrl: () => "http://localhost:4000/api/auth/google",
  logout: vi.fn(async () => ({ ok: true })),
  resendVerification: vi.fn(),
  fetchAdminArticles: vi.fn(async () => ({
    items: [
      {
        id: "article-pet",
        externalId: "wikipedia:en:Pet_door",
        title: "Pet door",
        source: "WIKIPEDIA",
        sourceUrl: "https://en.wikipedia.org/wiki/Pet_door",
        revisionId: "123",
        language: "en",
        wordCount: 12,
        createdAt: "2026-08-13T00:00:00.000Z",
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
  })),
}));

describe("AdminPlayPickerPage", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("lists stored articles with play links using the database id", async () => {
    render(<AdminPlayPickerPage />);
    expect(await screen.findByText("Pet door")).toBeInTheDocument();
    expect(screen.getByText("article-pet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play" })).toHaveAttribute(
      "href",
      "/admin/play/article-pet",
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search articles"), "article-pet");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => {
      expect(fetchAdminArticles).toHaveBeenCalledWith(1, 20, "article-pet");
    });
  });

  it("navigates when an article id is submitted", async () => {
    const user = userEvent.setup();
    render(<AdminPlayPickerPage />);
    await user.type(screen.getByLabelText("Article ID"), "wikipedia:en:Pinocchio");
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(push).toHaveBeenCalledWith(`/admin/play/${encodeURIComponent("wikipedia:en:Pinocchio")}`);
  });

  it("requires an article id", async () => {
    const user = userEvent.setup();
    render(<AdminPlayPickerPage />);
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(await screen.findByText("Enter a stored article id or external id.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("GamePage admin play", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchAdminArticlePuzzle.mockClear();
    vi.mocked(fetchTodayPuzzle).mockClear();
    vi.mocked(completeGame).mockClear();
    vi.mocked(fetchCurrentSession).mockClear();
    vi.mocked(fetchStats).mockClear();
  });

  it("plays a stored article without touching today's puzzle APIs", async () => {
    const user = userEvent.setup();
    render(<GamePage articleId="article-pet" />);

    const input = await screen.findByLabelText("Write a word");
    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
    expect(screen.getByText("Admin play")).toBeInTheDocument();
    expect(document.querySelector(".game-shell")).toBeTruthy();
    expect(document.querySelector(".control-pane")).toBeTruthy();
    expect(fetchAdminArticlePuzzle).toHaveBeenCalledWith("article-pet");
    expect(fetchTodayPuzzle).not.toHaveBeenCalled();
    expect(fetchCurrentSession).not.toHaveBeenCalled();
    expect(fetchStats).not.toHaveBeenCalled();

    await user.type(input, "ada");
    await user.click(screen.getByRole("button", { name: "Guess" }));
    await user.type(input, "lovelace");
    await user.click(screen.getByRole("button", { name: "Guess" }));

    await waitFor(() => {
      expect(screen.getByText(/you solved it/i)).toBeInTheDocument();
    });
    expect(completeGame).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY)).toBeNull();
    expect(window.localStorage.getItem(LOCAL_STORAGE_ADMIN_PLAY_KEY)).toBeTruthy();
  });

  it("shows an error when the article id is missing", async () => {
    fetchAdminArticlePuzzle.mockRejectedValueOnce(new Error("Article not found."));
    render(<GamePage articleId="missing" />);
    expect(await screen.findByText("Article not found.")).toBeInTheDocument();
    expect(screen.getByText("Check that the article id exists in the database.")).toBeInTheDocument();
  });
});
