-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ScheduledCleanup" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "frequencyDays" INTEGER NOT NULL DEFAULT 7,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledCleanup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanupRun" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "RunStatus" NOT NULL,
    "profilesFound" INTEGER NOT NULL DEFAULT 0,
    "profilesDeleted" INTEGER NOT NULL DEFAULT 0,
    "profilesFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "CleanupRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledCleanup_accountId_key" ON "ScheduledCleanup"("accountId");

-- CreateIndex
CREATE INDEX "ScheduledCleanup_nextRunAt_isEnabled_idx" ON "ScheduledCleanup"("nextRunAt", "isEnabled");

-- CreateIndex
CREATE INDEX "CleanupRun_accountId_startedAt_idx" ON "CleanupRun"("accountId", "startedAt");

-- AddForeignKey
ALTER TABLE "ScheduledCleanup" ADD CONSTRAINT "ScheduledCleanup_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanupRun" ADD CONSTRAINT "CleanupRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

