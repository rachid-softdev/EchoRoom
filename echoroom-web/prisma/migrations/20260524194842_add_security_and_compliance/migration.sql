-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedById" TEXT,
ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "consentAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "gdprDataExportedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AbuseReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbuseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedNumber" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "reason" TEXT,
    "blockedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCallLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyCallLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbuseReport_status_idx" ON "AbuseReport"("status");

-- CreateIndex
CREATE INDEX "AbuseReport_reporterId_idx" ON "AbuseReport"("reporterId");

-- CreateIndex
CREATE INDEX "AbuseReport_targetId_idx" ON "AbuseReport"("targetId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BlockedNumber_phoneNumber_key" ON "BlockedNumber"("phoneNumber");

-- CreateIndex
CREATE INDEX "DailyCallLimit_userId_idx" ON "DailyCallLimit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCallLimit_userId_date_key" ON "DailyCallLimit"("userId", "date");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedNumber" ADD CONSTRAINT "BlockedNumber_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCallLimit" ADD CONSTRAINT "DailyCallLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
