import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { emptyPuzzleStats } from "@redactle/shared";
import { ShareModal } from "../components/ShareModal";

describe("ShareModal", () => {
  it("shows solve stats, the puzzle link, and no fog or title glyphs", () => {
    render(
      <ShareModal
        open
        onClose={() => undefined}
        text={"WIKOGNITO #7\nWon\n12 guesses\n1m 30s\n75% accuracy\n\nhttp://localhost:3002/?puzzle=puzzle-test"}
        visual={{
          puzzleNumber: 7,
          won: true,
          guessCount: 12,
          durationMs: 90_000,
          accuracy: 0.75,
          puzzleId: "puzzle-test",
        }}
        puzzleStats={{
          ...emptyPuzzleStats("puzzle-test"),
          gamesPlayed: 4,
          medianGuessCount: 18,
          medianAccuracy: 0.6,
          medianDurationMs: 120_000,
          guessHistogram: { "12": 1, "18": 2, "40": 1 },
        }}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Share your result" });
    expect(dialog).toHaveTextContent("12");
    expect(dialog).toHaveTextContent("75%");
    expect(dialog).toHaveTextContent("1m 30s");
    expect(dialog).toHaveTextContent("Everyone on this puzzle");
    expect(dialog).toHaveTextContent("Puzzle link");
    expect(screen.getByRole("link", { name: /puzzle=puzzle-test/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy result" })).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("■");
    expect(dialog).not.toHaveTextContent("█");
    expect(dialog).not.toHaveTextContent("Ada Lovelace");
  });
});
