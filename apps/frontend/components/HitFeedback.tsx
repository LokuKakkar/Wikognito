"use client";

import type { GuessResult } from "@redactle/shared";

interface HitFeedbackProps {
  lastResult: GuessResult | null;
  titleHit: boolean;
}

function feedbackKind(lastResult: GuessResult | null, titleHit: boolean): "idle" | "duplicate" | "miss" | "hit" | "title" {
  if (!lastResult) return "idle";
  if (lastResult.isDuplicate) return "duplicate";
  if (!lastResult.isCorrect) return "miss";
  if (titleHit) return "title";
  return "hit";
}

export function HitFeedback({ lastResult, titleHit }: HitFeedbackProps) {
  let message = "Write a word in your notes. Tap a hit to find it in the file.";
  const kind = feedbackKind(lastResult, titleHit);

  if (lastResult?.isDuplicate) {
    message = `"${lastResult.normalizedGuess}" was already guessed.`;
  } else if (lastResult && lastResult.normalizedGuess) {
    if (lastResult.isCorrect && titleHit) {
      message = `"${lastResult.normalizedGuess}" — title word · ${lastResult.hitCount} hit${lastResult.hitCount === 1 ? "" : "s"}`;
    } else if (lastResult.isCorrect) {
      message = `"${lastResult.normalizedGuess}" — ${lastResult.hitCount} hit${lastResult.hitCount === 1 ? "" : "s"}`;
    } else {
      message = `"${lastResult.normalizedGuess}" — 0 hits`;
    }
  }

  return (
    <div className={`game-status status-in_progress is-${kind}`} role="status" data-feedback={kind}>
      {message}
    </div>
  );
}
