import { guessAccuracy } from "@redactle/puzzle-engine";
import { emptyPuzzleStats, type PuzzleStats } from "@redactle/shared";

export interface OfficialDailyRow {
  guessCount: number;
  hitGuessCount: number | null;
  durationMs: number;
  won: boolean;
  status: string;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function recomputePuzzleStats(puzzleId: string, rows: OfficialDailyRow[]): PuzzleStats {
  if (rows.length === 0) return emptyPuzzleStats(puzzleId);

  const gamesPlayed = rows.length;
  const gamesWon = rows.filter((row) => row.won).length;
  const gamesGaveUp = rows.filter((row) => row.status === "GAVE_UP").length;
  const guessCounts = rows.map((row) => row.guessCount);
  const accuracies = rows.map((row) => guessAccuracy(row.hitGuessCount ?? 0, row.guessCount) ?? 0);
  const durations = rows.map((row) => row.durationMs);
  const guessHistogram: Record<string, number> = {};
  for (const count of guessCounts) {
    const key = String(count);
    guessHistogram[key] = (guessHistogram[key] ?? 0) + 1;
  }

  const medGuess = median(guessCounts);
  const medAcc = median(accuracies);
  const medDur = median(durations);

  return {
    puzzleId,
    gamesPlayed,
    gamesWon,
    gamesGaveUp,
    medianGuessCount: medGuess == null ? null : Math.round(medGuess),
    medianAccuracy: medAcc,
    medianDurationMs: medDur == null ? null : Math.round(medDur),
    guessHistogram,
  };
}
