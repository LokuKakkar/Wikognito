"use client";

import type { GameResultResponse, GameStatus as Status, GuessResult } from "@redactle/shared";
import Link from "next/link";
import { formatAccuracy, formatClock } from "@/lib/share";

interface GameStatusProps {
  status: Status;
  lastResult: GuessResult | null;
  title?: string;
  guessCount?: number;
  startedAt?: number;
  completedAt?: number | null;
  currentStreak?: number | null;
  accuracy?: number | null;
  completion?: GameResultResponse | null;
  rank?: number | null;
  showLeaderboardCta?: boolean;
  onReplay?: () => void;
  onShare?: () => void;
}

export function GameStatus({
  status,
  lastResult,
  title,
  guessCount = 0,
  startedAt,
  completedAt,
  currentStreak,
  accuracy,
  completion,
  rank,
  showLeaderboardCta = false,
  onReplay,
  onShare,
}: GameStatusProps) {
  const accuracyLabel = formatAccuracy(accuracy ?? completion?.guessAccuracy);
  const score = completion?.scoreVersion === 1 ? completion.score : null;

  if (status === "WON") {
    return (
      <div className="game-status status-won terminal" role="status">
        <strong>Congratulations!</strong>
        <p>You solved:</p>
        <p className="answer">{title}</p>
        <p className="muted">
          {guessCount} guesses · {formatClock(startedAt, completedAt)}
          {accuracyLabel ? ` · ${accuracyLabel} Guess Accuracy` : ""}
        </p>
        {score != null ? (
          <p>
            Score: {score.toLocaleString()}
            {rank != null ? ` · Rank: #${rank}` : ""}
          </p>
        ) : null}
        {currentStreak != null ? <p className="muted">Current streak: {currentStreak}</p> : null}
        <div className="terminal-actions">
          {onShare ? (
            <button type="button" className="replay" onClick={onShare}>
              Share Result
            </button>
          ) : null}
          {showLeaderboardCta ? (
            <Link className="secondary-action" href="/leaderboard">
              View Leaderboard
            </Link>
          ) : null}
          <Link className="secondary-action" href="/stats">
            View Stats
          </Link>
          {onReplay ? (
            <button type="button" className="replay" onClick={onReplay}>
              Replay
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (status === "GAVE_UP") {
    return (
      <div className="game-status status-gave_up terminal" role="status">
        <strong>The answer was:</strong>
        <p className="answer">{title}</p>
        <p className="muted">
          {guessCount} guesses · {formatClock(startedAt, completedAt)}
        </p>
        <div className="terminal-actions">
          {onShare ? (
            <button type="button" className="replay" onClick={onShare}>
              Share Result
            </button>
          ) : null}
          <Link className="secondary-action" href="/stats">
            View Stats
          </Link>
          {onReplay ? (
            <button type="button" className="replay" onClick={onReplay}>
              Replay
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  let message = "Guess words to reveal the article. Reveal all title words to win.";

  if (lastResult?.isDuplicate) {
    message = `"${lastResult.normalizedGuess}" was already guessed.`;
  } else if (lastResult && lastResult.normalizedGuess) {
    message = lastResult.isCorrect
      ? `"${lastResult.normalizedGuess}" — ${lastResult.hitCount} hit${lastResult.hitCount === 1 ? "" : "s"}`
      : `"${lastResult.normalizedGuess}" — 0 hits`;
  }

  return (
    <div className="game-status status-in_progress" role="status">
      {message}
    </div>
  );
}
