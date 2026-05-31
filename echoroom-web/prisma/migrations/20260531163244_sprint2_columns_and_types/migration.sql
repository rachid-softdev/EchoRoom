-- AlterEnum
ALTER TYPE "CallStatus" ADD VALUE 'CALLING';

-- AlterTable: change featuredDate from String to DateTime
-- Drop the existing unique index first since the column type is changing
DROP INDEX IF EXISTS "FeaturedScenario_featuredDate_key";
ALTER TABLE "FeaturedScenario" ALTER COLUMN "featuredDate" TYPE TIMESTAMP(3) USING "featuredDate"::timestamp without time zone;
ALTER TABLE "FeaturedScenario" ALTER COLUMN "featuredDate" SET NOT NULL;
CREATE UNIQUE INDEX "FeaturedScenario_featuredDate_key" ON "FeaturedScenario"("featuredDate");
