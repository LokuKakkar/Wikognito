"use client";

import type { ClientPuzzle } from "@redactle/shared";
import { PuzzleTokenView } from "./PuzzleToken";

interface PuzzleArticleProps {
  puzzle: ClientPuzzle;
  revealedTokenIds: Set<string>;
  justRevealedTokenIds?: Set<string>;
  historyFocusTokenIds?: Set<string>;
  displayValueForToken: (tokenId: string) => string | undefined;
}

export function PuzzleArticle({
  puzzle,
  revealedTokenIds,
  justRevealedTokenIds,
  historyFocusTokenIds,
  displayValueForToken,
}: PuzzleArticleProps) {
  const fresh = justRevealedTokenIds ? [...justRevealedTokenIds] : [];
  return (
    <article className="puzzle-article" aria-label="Redacted article">
      {puzzle.content.map((token) => {
        const justRevealed = justRevealedTokenIds?.has(token.tokenId) ?? false;
        const delay = justRevealed ? Math.min(12, fresh.indexOf(token.tokenId)) * 28 : 0;
        return (
          <PuzzleTokenView
            key={token.tokenId}
            token={token}
            revealed={revealedTokenIds.has(token.tokenId)}
            justRevealed={justRevealed}
            historyFocus={historyFocusTokenIds?.has(token.tokenId) ?? false}
            revealDelayMs={delay}
            displayValue={displayValueForToken(token.tokenId)}
          />
        );
      })}
    </article>
  );
}
