-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('PREFIX', 'SUFFIX', 'CONTAINS', 'DOMAIN');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "klaviyoAccountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanupRule" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleanupRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletionLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "profileEmail" TEXT NOT NULL,
    "profileId" TEXT,
    "ruleMatched" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_klaviyoAccountId_key" ON "Account"("klaviyoAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CleanupRule_accountId_type_pattern_key" ON "CleanupRule"("accountId", "type", "pattern");

-- AddForeignKey
ALTER TABLE "CleanupRule" ADD CONSTRAINT "CleanupRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionLog" ADD CONSTRAINT "DeletionLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
