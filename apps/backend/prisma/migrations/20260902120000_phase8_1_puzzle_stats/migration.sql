-- CreateTable
CREATE TABLE "PuzzleStats" (
    "puzzleId" TEXT NOT NULL,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "gamesGaveUp" INTEGER NOT NULL DEFAULT 0,
    "medianGuessCount" INTEGER,
    "medianAccuracy" DOUBLE PRECISION,
    "medianDurationMs" INTEGER,
    "guessHistogram" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PuzzleStats_pkey" PRIMARY KEY ("puzzleId")
);

-- AddForeignKey
ALTER TABLE "PuzzleStats" ADD CONSTRAINT "PuzzleStats_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
