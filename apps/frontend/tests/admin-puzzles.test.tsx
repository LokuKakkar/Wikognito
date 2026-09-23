import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPuzzlesPage } from "../components/admin/AdminPuzzlesPage";

const fetchAdminPuzzles = vi.fn();
const generateAdminPuzzle = vi.fn();
const validateAdminPuzzles = vi.fn();
const publishTodayPuzzle = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    fetchAdminPuzzles: (...args: unknown[]) => fetchAdminPuzzles(...args),
    generateAdminPuzzle: (...args: unknown[]) => generateAdminPuzzle(...args),
    validateAdminPuzzles: (...args: unknown[]) => validateAdminPuzzles(...args),
    publishTodayPuzzle: (...args: unknown[]) => publishTodayPuzzle(...args),
  };
});

describe("AdminPuzzlesPage", () => {
  beforeEach(() => {
    fetchAdminPuzzles.mockReset();
    generateAdminPuzzle.mockReset();
    validateAdminPuzzles.mockReset();
    publishTodayPuzzle.mockReset();
    fetchAdminPuzzles.mockResolvedValue({
      items: [
        {
          id: "puzzle-1",
          articleId: "article-ada-lovelace",
          title: "Ada Lovelace",
          status: "READY",
          generatorVersion: "2.0.0",
          puzzleNumber: 0,
          scheduledDate: null,
          wordCount: 30,
          guessableWordCount: 14,
          uniqueGuessableWordCount: 14,
          titleTokenCount: 2,
          createdAt: "2026-08-20T00:00:00.000Z",
          publishedAt: null,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
  });

  it("lists puzzles and generates from an article id", async () => {
    const user = userEvent.setup();
    generateAdminPuzzle.mockResolvedValue({
      status: "GENERATED",
      articleId: "article-ada-lovelace",
      articleTitle: "Ada Lovelace",
      puzzleId: "puzzle-1",
    });
    render(<AdminPuzzlesPage />);
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Article ID"), "article-ada-lovelace");
    await user.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => {
      expect(generateAdminPuzzle).toHaveBeenCalledWith("article-ada-lovelace", false);
    });
    expect(await screen.findByText(/Puzzle generated successfully/i)).toBeInTheDocument();
  });
});
