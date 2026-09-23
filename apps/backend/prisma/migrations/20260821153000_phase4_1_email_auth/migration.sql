-- AlterEnum
ALTER TYPE "AuthProvider" ADD VALUE 'EMAIL';

-- AlterTable
ALTER TABLE "AuthIdentity" ADD COLUMN "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
