"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChartColumn, RotateCcw, Share2, Trophy } from "lucide-react";
import { prefersReducedMotion } from "@/lib/motion";
import { Icon } from "./ui/Icon";
import { DeskProp } from "./desk/DeskProp";

interface ResultCeremonyProps {
  variant: "live" | "filed";
  status: "WON" | "GAVE_UP";
  title?: string;
  puzzleNumber: number;
  score?: number | null;
  rank?: number | null;
  currentStreak?: number | null;
  showLeaderboardCta?: boolean;
  showShare?: boolean;
  onReplay?: () => void;
  onShare?: () => void;
}

export function ResultCeremony({
  variant,
  status,
  title,
  puzzleNumber,
  score,
  rank,
  currentStreak,
  showLeaderboardCta = false,
  showShare = true,
  onReplay,
  onShare,
}: ResultCeremonyProps) {
  const won = status === "WON";
  const [shownScore, setShownScore] = useState(0);

  useEffect(() => {
    if (score == null || !won) {
      setShownScore(0);
      return;
    }
    if (prefersReducedMotion()) {
      setShownScore(score);
      return;
    }
    const start = performance.now();
    const duration = 800;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShownScore(Math.round(score * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score, won]);

  return (
    <section className={`result-ceremony${won ? " is-won" : " is-gave-up"}`} role="status">
      <p className="case-kicker">{variant === "filed" ? "Already filed" : won ? "Case filed" : "Case closed"}</p>
      <div className="result-heading-row">
        <h2 className="result-heading">{won ? "You solved it" : "The answer was"}</h2>
        {won ? (
          <DeskProp
            className="result-illo"
            src="/assets/detective/ui/medal-1.png"
            width={78}
            height={96}
          />
        ) : null}
      </div>
      {title ? <p className="answer">{title}</p> : <p className="answer">Puzzle #{puzzleNumber}</p>}
      {won && score != null ? (
        <p className="result-score">
          Score {shownScore.toLocaleString()}
          {rank != null ? ` · Rank #${rank}` : ""}
        </p>
      ) : null}
      {currentStreak != null && currentStreak > 0 ? <p className="muted">Streak {currentStreak}</p> : null}
      <div className="terminal-actions">
        {showShare && onShare ? (
          <button type="button" className="replay" onClick={onShare}>
            <Icon icon={Share2} />
            Share Result
          </button>
        ) : null}
        {showLeaderboardCta ? (
          <Link className="secondary-action" href="/leaderboard">
            <Icon icon={Trophy} />
            View Leaderboard
          </Link>
        ) : null}
        <Link className="secondary-action" href="/stats">
          <Icon icon={ChartColumn} />
          View Stats
        </Link>
        {onReplay ? (
          <button type="button" className="replay" onClick={onReplay}>
            <Icon icon={RotateCcw} />
            Replay
          </button>
        ) : null}
      </div>
    </section>
  );
}
