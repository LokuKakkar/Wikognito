-- CreateEnum
CREATE TYPE "DossierStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT,
    "status" "DossierStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierCaseFile" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DossierCaseFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dossier_slug_key" ON "Dossier"("slug");

-- CreateIndex
CREATE INDEX "Dossier_status_idx" ON "Dossier"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DossierCaseFile_dossierId_puzzleId_key" ON "DossierCaseFile"("dossierId", "puzzleId");

-- CreateIndex
CREATE UNIQUE INDEX "DossierCaseFile_dossierId_position_key" ON "DossierCaseFile"("dossierId", "position");

-- CreateIndex
CREATE INDEX "DossierCaseFile_puzzleId_idx" ON "DossierCaseFile"("puzzleId");

-- AddForeignKey
ALTER TABLE "DossierCaseFile" ADD CONSTRAINT "DossierCaseFile_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierCaseFile" ADD CONSTRAINT "DossierCaseFile_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
