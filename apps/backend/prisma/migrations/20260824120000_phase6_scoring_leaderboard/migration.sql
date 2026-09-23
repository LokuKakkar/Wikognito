-- AlterTable
ALTER TABLE "Puzzle" ADD COLUMN "difficultyValue" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Puzzle" ADD COLUMN "difficultyVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN "hitGuessCount" INTEGER;
ALTER TABLE "GameResult" ADD COLUMN "scoreVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "GameResult_leaderboard_idx"
  ON "GameResult"("puzzleId", "source", "isOfficial", "won", "scoreVersion", "score" DESC, "completedAt");

-- Backfill published/ready puzzle difficulty from stored metrics (difficulty v1).
UPDATE "Puzzle"
SET
  "difficultyVersion" = 1,
  "difficultyValue" = GREATEST(
    1,
    LEAST(
      100,
      ROUND(
        1 + 99 * (
          0.60 * LEAST(1, GREATEST(0, ("uniqueGuessableWordCount" - 80)::double precision / 420)) +
          0.25 * LEAST(1, GREATEST(0, ("guessableWordCount" - 300)::double precision / 2200)) +
          0.15 * LEAST(1, GREATEST(0, ("titleTokenCount" - 1)::double precision / 4))
        )
      )
    )
  );
