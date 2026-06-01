-- Rollback: 20260601000000_add_user_partitioning
-- Drops the UserProfile, UserSocial, and UserBilling tables

DROP INDEX IF EXISTS "UserBilling_userId_idx";
DROP INDEX IF EXISTS "UserSocial_totalCallsMade_idx";
DROP INDEX IF EXISTS "UserSocial_totalLikesReceived_idx";
DROP INDEX IF EXISTS "UserSocial_userId_idx";
DROP INDEX IF EXISTS "UserProfile_userId_idx";

ALTER TABLE "UserBilling" DROP CONSTRAINT IF EXISTS "UserBilling_userId_fkey";
ALTER TABLE "UserSocial" DROP CONSTRAINT IF EXISTS "UserSocial_userId_fkey";
ALTER TABLE "UserProfile" DROP CONSTRAINT IF EXISTS "UserProfile_userId_fkey";

DROP TABLE IF EXISTS "UserBilling";
DROP TABLE IF EXISTS "UserSocial";
DROP TABLE IF EXISTS "UserProfile";
