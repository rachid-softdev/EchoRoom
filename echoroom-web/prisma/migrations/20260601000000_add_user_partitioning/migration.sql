-- CreateTable UserProfile
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "image" TEXT,
    "displayName" TEXT,
    "bio" TEXT,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserSocial
CREATE TABLE "UserSocial" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalLikesReceived" INTEGER NOT NULL DEFAULT 0,
    "totalCallsMade" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserSocial_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserBilling
CREATE TABLE "UserBilling" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "UserBilling_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");
CREATE UNIQUE INDEX "UserSocial_userId_key" ON "UserSocial"("userId");
CREATE INDEX "UserSocial_userId_idx" ON "UserSocial"("userId");
CREATE INDEX "UserSocial_totalLikesReceived_idx" ON "UserSocial"("totalLikesReceived" DESC);
CREATE INDEX "UserSocial_totalCallsMade_idx" ON "UserSocial"("totalCallsMade" DESC);
CREATE UNIQUE INDEX "UserBilling_userId_key" ON "UserBilling"("userId");
CREATE INDEX "UserBilling_userId_idx" ON "UserBilling"("userId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSocial" ADD CONSTRAINT "UserSocial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBilling" ADD CONSTRAINT "UserBilling_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
