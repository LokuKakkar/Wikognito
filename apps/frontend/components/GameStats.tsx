"use client";

import type { StatsResponse } from "@redactle/shared";

interface GameStatsProps {
  stats: StatsResponse | null;
  progress: { revealedWords: number; totalRedactedWords: number };
  guessCount: number;
}

export function GameStats({ stats, progress, guessCount }: GameStatsProps) {
  return (
    <div className="game-stats">
      <div>
        Guesses: <strong>{guessCount}</strong>
      </div>
      <div>
        Revealed:{" "}
        <strong>
          {progress.revealedWords}/{progress.totalRedactedWords}
        </strong>
      </div>
      {stats ? (
        <div className="lifetime-stats">
          Lifetime: {stats.gamesWon}/{stats.gamesPlayed} wins
          {stats.bestGuessCount != null ? ` · best ${stats.bestGuessCount}` : ""}
        </div>
      ) : null}
    </div>
  );
}
