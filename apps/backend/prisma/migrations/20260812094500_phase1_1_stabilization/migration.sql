-- DropIndex
DROP INDEX "GameResult_sessionId_puzzleId_key";

-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN     "attemptId" TEXT NOT NULL,
ADD COLUMN     "attemptNumber" INTEGER NOT NULL,
ADD COLUMN     "isOfficial" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "GameResult_sessionId_puzzleId_idx" ON "GameResult"("sessionId", "puzzleId");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_sessionId_attemptId_key" ON "GameResult"("sessionId", "attemptId");
