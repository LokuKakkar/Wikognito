import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { emptyPuzzleStats } from "@redactle/shared";
import { SolveStatsModal } from "../components/SolveStatsModal";

describe("SolveStatsModal", () => {
  it("shows player and global stats without the article title", () => {
    render(
      <SolveStatsModal
        open
        onClose={() => undefined}
        status="WON"
        guessCount={12}
        durationMs={90_000}
        accuracy={0.75}
        puzzleStats={{
          ...emptyPuzzleStats("puzzle-test"),
          gamesPlayed: 4,
          gamesWon: 3,
          medianGuessCount: 18,
          medianAccuracy: 0.6,
          medianDurationMs: 120_000,
          guessHistogram: { "12": 1, "18": 2, "40": 1 },
        }}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Solve stats" });
    expect(dialog).toHaveTextContent("12");
    expect(dialog).toHaveTextContent("75%");
    expect(dialog).toHaveTextContent("4");
    expect(dialog).toHaveTextContent("18");
    expect(dialog).not.toHaveTextContent("Ada Lovelace");
    expect(dialog).not.toHaveTextContent("lovelace");
    expect(screen.getByLabelText("Guess count histogram")).toBeInTheDocument();
    const xLabels = document.querySelector(".guess-histogram-x-labels")?.textContent ?? "";
    expect(xLabels).toContain("1");
    expect(xLabels).toContain("6");
    expect(xLabels).toContain("11");
    expect(xLabels).toContain("36");
  });

  it("makes the guest sign-in prompt a visible card", () => {
    render(
      <SolveStatsModal
        open
        onClose={() => undefined}
        status="WON"
        guessCount={12}
        durationMs={90_000}
        accuracy={0.75}
        showGuestNudge
        puzzleStats={emptyPuzzleStats("puzzle-test")}
      />,
    );

    expect(screen.getByText("Keep this result")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in with Google" })).toBeInTheDocument();
  });
});
