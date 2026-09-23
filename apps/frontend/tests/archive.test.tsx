import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ArchivePage } from "../components/ArchivePage";

const fetchMe = vi.fn();
const fetchArchiveList = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/archive",
}));

vi.mock("@/lib/api", () => ({
  fetchMe: (...args: unknown[]) => fetchMe(...args),
  fetchArchiveList: (...args: unknown[]) => fetchArchiveList(...args),
  googleAuthUrl: () => "http://localhost:4000/api/auth/google",
  logout: vi.fn(),
  resendVerification: vi.fn(),
}));

describe("ArchivePage", () => {
  beforeEach(() => {
    fetchMe.mockResolvedValue(null);
    fetchArchiveList.mockResolvedValue({
      items: [
        { puzzleId: "p-182", puzzleNumber: 182, date: "2026-08-20", playState: "COMPLETED" },
        { puzzleId: "p-181", puzzleNumber: 181, date: "2026-08-19", playState: "UNPLAYED" },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
    });
  });

  it("lists archive puzzles for anonymous visitors", async () => {
    render(<ArchivePage />);
    expect(await screen.findByText("#182")).toBeInTheDocument();
    expect(screen.getByText("#181")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /#182/ })).toHaveAttribute("href", "/?puzzle=p-182");
    expect(screen.getByText("Replay")).toBeInTheDocument();
    expect(screen.getAllByText("Play").length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(fetchArchiveList).toHaveBeenCalled();
    });
  });
});
