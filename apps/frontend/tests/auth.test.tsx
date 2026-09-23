import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthBar } from "../components/AuthBar";
import { StatsPage } from "../components/StatsPage";
import { AdminGate } from "../components/admin/AdminGate";
import { LoginPage } from "../components/LoginPage";

const fetchMe = vi.fn();
const fetchUserStats = vi.fn();
const logout = vi.fn();
const loginWithEmail = vi.fn();
const registerWithEmail = vi.fn();
const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/",
}));

vi.mock("@/lib/api", () => ({
  fetchMe: (...args: unknown[]) => fetchMe(...args),
  fetchUserStats: (...args: unknown[]) => fetchUserStats(...args),
  logout: (...args: unknown[]) => logout(...args),
  loginWithEmail: (...args: unknown[]) => loginWithEmail(...args),
  registerWithEmail: (...args: unknown[]) => registerWithEmail(...args),
  googleAuthUrl: () => "http://localhost:4000/api/auth/google",
  fetchArchiveList: vi.fn(),
  fetchHistory: vi.fn(),
  resendVerification: vi.fn(),
}));

describe("AuthBar", () => {
  beforeEach(() => {
    fetchMe.mockReset();
    logout.mockReset();
    push.mockReset();
  });

  it("shows Google sign-in when anonymous", async () => {
    fetchMe.mockResolvedValue(null);
    render(<AuthBar />);
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign in with Google" })).toHaveAttribute(
      "href",
      "http://localhost:4000/api/auth/google",
    );
  });

  it("opens an accessible mobile menu", async () => {
    fetchMe.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<AuthBar />);
    await screen.findByRole("link", { name: "Sign in" });
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("link", { name: "Settings" }).length).toBeGreaterThanOrEqual(1);
  });

  it("shows stats and logout when authenticated", async () => {
    fetchMe.mockResolvedValue({
      id: "user-1",
      displayName: "Lokesh",
      email: "lokesh@example.com",
      avatarUrl: null,
      role: "USER",
    });
    logout.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AuthBar />);
    expect(await screen.findByText("Lokesh")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stats" })).toHaveAttribute("href", "/stats");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    await user.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => {
      expect(logout).toHaveBeenCalledOnce();
    });
    expect(push).toHaveBeenCalledWith("/");
  });
});

describe("StatsPage", () => {
  beforeEach(() => {
    fetchMe.mockReset();
    fetchUserStats.mockReset();
    fetchMe.mockResolvedValue({
      id: "user-1",
      displayName: "Lokesh",
      email: "lokesh@example.com",
      avatarUrl: null,
      role: "USER",
    });
  });

  it("renders official statistics", async () => {
    fetchUserStats.mockResolvedValue({
      gamesPlayed: 23,
      gamesWon: 18,
      gamesGaveUp: 5,
      winRate: 0.7826,
      currentStreak: 4,
      longestStreak: 9,
      averageGuesses: 31.2,
      averageCompletionTimeMs: 258_000,
      guessAccuracy: 0.71,
      calendarStart: "2026-07-22",
      activity: [],
      trends: [],
    });
    render(<StatsPage />);
    expect(await screen.findByText("23")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("78.3%")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("31.2")).toBeInTheDocument();
    expect(screen.getByText("4m 18s")).toBeInTheDocument();
  });
});

describe("AdminGate", () => {
  beforeEach(() => {
    fetchMe.mockReset();
    replace.mockReset();
  });

  it("redirects anonymous users home", async () => {
    fetchMe.mockResolvedValue(null);
    render(
      <AdminGate>
        <p>secret</p>
      </AdminGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("redirects USER role home", async () => {
    fetchMe.mockResolvedValue({
      id: "user-1",
      displayName: "Lokesh",
      email: "lokesh@example.com",
      avatarUrl: null,
      role: "USER",
    });
    render(
      <AdminGate>
        <p>secret</p>
      </AdminGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  it("renders admin children for ADMIN", async () => {
    fetchMe.mockResolvedValue({
      id: "admin-1",
      displayName: "Admin",
      email: "admin@example.com",
      avatarUrl: null,
      role: "ADMIN",
    });
    render(
      <AdminGate>
        <p>secret</p>
      </AdminGate>,
    );
    expect(await screen.findByText("secret")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("LoginPage", () => {
  beforeEach(() => {
    fetchMe.mockReset();
    loginWithEmail.mockReset();
    push.mockReset();
    fetchMe.mockResolvedValue(null);
  });

  it("signs in with email and returns to today's puzzle", async () => {
    loginWithEmail.mockResolvedValue({
      id: "user-1",
      displayName: "Player",
      email: "player@example.com",
      avatarUrl: null,
      role: "USER",
    });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(loginWithEmail).toHaveBeenCalledWith("player@example.com", "password123");
    });
    expect(push).toHaveBeenCalledWith("/");
  });
});
