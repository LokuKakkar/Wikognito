"use client";

import type { OfficialResultSummary } from "@redactle/shared";
import { formatAccuracy, formatDurationMs } from "@/lib/share";

interface OfficialResultCardProps {
  officialResult: OfficialResultSummary;
  puzzleNumber: number;
  onReplay: () => void;
}

export function OfficialResultCard({ officialResult, puzzleNumber, onReplay }: OfficialResultCardProps) {
  const accuracy = formatAccuracy(officialResult.guessAccuracy);
  return (
    <section className="page">
      <div className="game-status terminal" role="status">
        <h2>Puzzle #{puzzleNumber}</h2>
        <p>Your official result:</p>
        <p className="answer">{officialResult.status === "WON" ? "Won" : "Gave Up"}</p>
        <p className="muted">
          {officialResult.guessCount} guesses
          {officialResult.status === "WON" ? ` · ${formatDurationMs(officialResult.durationMs)}` : ""}
          {accuracy ? ` · ${accuracy} Guess Accuracy` : ""}
        </p>
        {officialResult.status === "WON" && officialResult.scoreVersion === 1 ? (
          <p>Score: {officialResult.score.toLocaleString()}</p>
        ) : null}
        <button type="button" className="replay" onClick={onReplay}>
          Replay
        </button>
      </div>
    </section>
  );
}
