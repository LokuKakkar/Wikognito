import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaderboardPage } from "../components/LeaderboardPage";

const fetchMe = vi.fn();
const fetchTodayLeaderboard = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/leaderboard",
}));

vi.mock("@/lib/api", () => ({
  fetchMe: (...args: unknown[]) => fetchMe(...args),
  fetchTodayLeaderboard: (...args: unknown[]) => fetchTodayLeaderboard(...args),
  googleAuthUrl: () => "http://localhost:4000/api/auth/google",
  logout: vi.fn(),
  resendVerification: vi.fn(),
}));

describe("LeaderboardPage", () => {
  beforeEach(() => {
    fetchMe.mockResolvedValue({
      id: "user-1",
      displayName: "Alex",
      email: "alex@example.com",
      avatarUrl: null,
      role: "USER",
    });
    fetchTodayLeaderboard.mockResolvedValue({
      puzzleNumber: 183,
      date: "2026-08-21",
      page: 1,
      pageSize: 20,
      total: 1,
      authenticated: true,
      played: true,
      me: { rank: 1, score: 9842 },
      entries: [
        { rank: 1, displayName: "Alex", avatarUrl: null, score: 9842, isCurrentUser: true },
      ],
    });
  });

  it("renders today's ranks and highlights the current user", async () => {
    render(<LeaderboardPage />);
    expect(await screen.findByText("Today’s Wikognito")).toBeInTheDocument();
    expect(screen.getByText("Top Detectives")).toBeInTheDocument();
    expect(screen.getByText("Puzzle #183")).toBeInTheDocument();
    expect(screen.getAllByText("Alex").length).toBeGreaterThan(0);
    expect(screen.getByText("9,842")).toBeInTheDocument();
    expect(document.querySelector(".leaderboard-row.is-me")).toBeTruthy();
  });
});
