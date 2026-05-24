-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "totalCallsMade" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalLikesReceived" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Clip',
    "startTime" INTEGER NOT NULL,
    "endTime" INTEGER NOT NULL,
    "clipUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "criteria" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedScenario" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "featuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "featureType" TEXT NOT NULL DEFAULT 'AUTOMATED',

    CONSTRAINT "FeaturedScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Clip_callId_idx" ON "Clip"("callId");

-- CreateIndex
CREATE INDEX "Clip_userId_idx" ON "Clip"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_name_key" ON "Badge"("name");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "FeaturedScenario_scenarioId_idx" ON "FeaturedScenario"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedScenario_featuredAt_key" ON "FeaturedScenario"("featuredAt");

-- CreateIndex
CREATE INDEX "Scenario_likeCount_idx" ON "Scenario"("likeCount" DESC);

-- CreateIndex
CREATE INDEX "Scenario_playCount_idx" ON "Scenario"("playCount" DESC);

-- CreateIndex
CREATE INDEX "Scenario_createdAt_idx" ON "Scenario"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "User_totalLikesReceived_idx" ON "User"("totalLikesReceived" DESC);

-- CreateIndex
CREATE INDEX "User_totalCallsMade_idx" ON "User"("totalCallsMade" DESC);

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedScenario" ADD CONSTRAINT "FeaturedScenario_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
