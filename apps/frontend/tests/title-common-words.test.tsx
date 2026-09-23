import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { applyPlayDifficulty } from "@redactle/shared";
import { generatePuzzle, decodeClientPayload } from "@redactle/puzzle-engine";
import { PuzzleArticle } from "../components/PuzzleArticle";

describe("title common words", () => {
  it("renders common title words and hides the required title tokens", () => {
    const puzzle = decodeClientPayload(
      generatePuzzle({
        puzzleId: "puzzle-lotr",
        puzzleNumber: 1,
        scheduledDate: "2026-08-20",
        generatorVersion: "2.0.0",
        title: "The Lord of the Rings",
        body: "The Lord of the Rings is a novel. Lord and Rings appear in the title.",
      }).publicDto.payload,
    );

    render(
      <PuzzleArticle
        puzzle={puzzle}
        revealedTokenIds={new Set()}
        displayValueForToken={() => undefined}
      />,
    );

    const article = screen.getByLabelText("Redacted article");
    expect(article.textContent).toContain("The");
    expect(article.textContent).toContain("of");
    expect(article.textContent).not.toContain("Lord");
    expect(article.textContent).not.toContain("Rings");
    expect(document.querySelectorAll(".word.redacted").length).toBeGreaterThan(0);
  });

  it("reveals more everyday words as difficulty gets easier", () => {
    const decoded = decodeClientPayload(
      generatePuzzle({
        puzzleId: "puzzle-difficulty",
        puzzleNumber: 2,
        scheduledDate: "2026-09-22",
        generatorVersion: "2.0.0",
        title: "Ada Lovelace",
        body: "I was also there. People make machines.",
      }).publicDto.payload,
    );

    function textFor(difficulty: "easy" | "medium" | "hard"): string {
      const view = render(
        <PuzzleArticle
          puzzle={applyPlayDifficulty(decoded, difficulty)}
          revealedTokenIds={new Set()}
          displayValueForToken={() => undefined}
        />,
      );
      const text = screen.getByLabelText("Redacted article").textContent ?? "";
      view.unmount();
      return text;
    }

    const hard = textFor("hard");
    expect(hard).toContain("was");
    expect(hard).not.toContain("also");
    expect(hard).not.toContain("make");

    const medium = textFor("medium");
    expect(medium).toContain("I");
    expect(medium).not.toContain("also");
    expect(medium).not.toContain("make");

    const easy = textFor("easy");
    expect(easy).toContain("I");
    expect(easy).toContain("also");
    expect(easy).toContain("there");
    expect(easy).toContain("make");
    expect(easy).not.toContain("People");
    expect(easy).not.toContain("machines");
  });
});
