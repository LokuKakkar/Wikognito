-- AlterEnum
ALTER TYPE "PuzzleStatus" ADD VALUE 'READY';
ALTER TYPE "PuzzleStatus" ADD VALUE 'ARCHIVED';

-- DropIndex
DROP INDEX "Puzzle_scheduledDate_key";

-- AlterTable
ALTER TABLE "Puzzle" ALTER COLUMN "puzzleNumber" SET DEFAULT 0,
ALTER COLUMN "scheduledDate" DROP NOT NULL,
ADD COLUMN "wordCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "guessableWordCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "uniqueGuessableWordCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "titleTokenCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DailyPuzzle" (
    "date" DATE NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPuzzle_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyPuzzle_puzzleId_key" ON "DailyPuzzle"("puzzleId");

-- CreateIndex
CREATE INDEX "Puzzle_status_createdAt_idx" ON "Puzzle"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Puzzle_articleId_generatorVersion_status_idx" ON "Puzzle"("articleId", "generatorVersion", "status");

-- AddForeignKey
ALTER TABLE "DailyPuzzle" ADD CONSTRAINT "DailyPuzzle_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill daily assignments from previously published puzzles.
INSERT INTO "DailyPuzzle" ("date", "puzzleId", "publishedAt")
SELECT "scheduledDate", "id", COALESCE("publishedAt", CURRENT_TIMESTAMP)
FROM "Puzzle"
WHERE "status" = 'PUBLISHED' AND "scheduledDate" IS NOT NULL
ON CONFLICT ("date") DO NOTHING;
