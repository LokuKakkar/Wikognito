"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { ActivityDay, PuzzleStats } from "@redactle/shared";
import { UserPlus, X } from "lucide-react";
import { googleAuthUrl } from "@/lib/api";
import { ActivityCalendar } from "./stats/ActivityCalendar";
import { SolveStatsDetails } from "./stats/SolveStatsDetails";
import { Icon } from "./ui/Icon";

interface SolveStatsModalProps {
  open: boolean;
  onClose: () => void;
  status: "WON" | "GAVE_UP";
  guessCount: number;
  durationMs: number;
  accuracy: number | null;
  puzzleStats: PuzzleStats;
  activity?: ActivityDay[];
  calendarStart?: string;
  showGuestNudge?: boolean;
}

export function SolveStatsModal({
  open,
  onClose,
  status,
  guessCount,
  durationMs,
  accuracy,
  puzzleStats,
  activity,
  calendarStart,
  showGuestNudge = false,
}: SolveStatsModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal solve-stats-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Solve stats"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="solve-stats-head">
          <div>
            <p className="case-notice-kicker">
              {status === "WON" ? "Investigation summary" : "Attempt closed"}
            </p>
            <strong>{status === "WON" ? "Your result" : "Attempt closed"}</strong>
          </div>
          <button type="button" className="icon-button" aria-label="Close solve stats" onClick={onClose}>
            <Icon icon={X} />
          </button>
        </div>
        <SolveStatsDetails
          guessCount={guessCount}
          durationMs={durationMs}
          accuracy={accuracy}
          puzzleStats={puzzleStats}
        >
          {showGuestNudge ? (
            <div className="guest-nudge-card">
              <p className="guest-nudge-title">
                <Icon icon={UserPlus} size="chip" />
                Keep this result
              </p>
              <p>Sign in to save the official finish and start a streak.</p>
              <div className="guest-nudge-actions">
                <Link className="replay" href="/login">
                  Sign in
                </Link>
                <a className="secondary-action" href={googleAuthUrl()}>
                  Sign in with Google
                </a>
              </div>
            </div>
          ) : null}
          {activity ? (
            <div className="solve-stats-calendar">
              <ActivityCalendar activity={activity} calendarStart={calendarStart} compact />
            </div>
          ) : null}
        </SolveStatsDetails>
      </div>
    </div>
  );
}
