import type { ReactNode } from "react";
import type { PuzzleStats } from "@redactle/shared";
import { formatAccuracy, formatDurationMs } from "@/lib/share";
import {
  bucketStartForGuesses,
  buildGuessHistogram,
  yAxisTicks,
} from "@/lib/guess-histogram";

interface SolveStatsDetailsProps {
  guessCount: number;
  durationMs: number;
  accuracy: number | null;
  puzzleStats: PuzzleStats;
  children?: ReactNode;
}

export function SolveStatsDetails({
  guessCount,
  durationMs,
  accuracy,
  puzzleStats,
  children,
}: SolveStatsDetailsProps) {
  const accuracyLabel = formatAccuracy(accuracy);
  const medianAccuracy = formatAccuracy(puzzleStats.medianAccuracy);
  const { buckets, bucketSize } = buildGuessHistogram(puzzleStats.guessHistogram);
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const ticks = yAxisTicks(maxCount);
  const yMax = ticks[ticks.length - 1] ?? 1;
  const playerBucket = bucketStartForGuesses(guessCount, bucketSize);

  return (
    <>
      <dl className="solve-stats-grid">
        <div>
          <dt>Guesses</dt>
          <dd>{guessCount}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{accuracyLabel ?? "—"}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{formatDurationMs(durationMs)}</dd>
        </div>
      </dl>
      {children}
      <h3 className="solve-stats-global-heading">Everyone on this puzzle</h3>
      <dl className="solve-stats-grid">
        <div>
          <dt>Games played</dt>
          <dd>{puzzleStats.gamesPlayed}</dd>
        </div>
        <div>
          <dt>Median guesses</dt>
          <dd>{puzzleStats.medianGuessCount ?? "—"}</dd>
        </div>
        <div>
          <dt>Median accuracy</dt>
          <dd>{medianAccuracy ?? "—"}</dd>
        </div>
        <div>
          <dt>Median time</dt>
          <dd>
            {puzzleStats.medianDurationMs == null ? "—" : formatDurationMs(puzzleStats.medianDurationMs)}
          </dd>
        </div>
      </dl>
      {buckets.length > 0 ? (
        <div className="guess-histogram" aria-label="Guess count histogram">
          <div className="guess-histogram-plot">
            <div className="guess-histogram-y" aria-hidden>
              {[...ticks].reverse().map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
            <div className="guess-histogram-grid">
              {ticks.slice(1).map((tick) => (
                <span
                  key={tick}
                  className="guess-histogram-gridline"
                  style={{ bottom: `${(tick / yMax) * 100}%` }}
                />
              ))}
              <div className="guess-histogram-bars">
                {buckets.map((bucket) => (
                  <div
                    key={bucket.start}
                    className={`guess-histogram-col${bucket.start === playerBucket ? " is-you" : ""}`}
                    title={`${bucket.label}: ${bucket.count} ${bucket.count === 1 ? "player" : "players"}`}
                  >
                    <span
                      className="guess-histogram-bar"
                      style={{ height: `${(bucket.count / yMax) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="guess-histogram-x" aria-hidden>
            <span className="guess-histogram-y-spacer" />
            <div className="guess-histogram-x-labels">
              {buckets.map((bucket) => (
                <span key={bucket.start}>{bucket.label}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="muted">No official daily finishes yet.</p>
      )}
    </>
  );
}
