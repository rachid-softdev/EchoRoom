-- Add CHECK constraint to prevent negative credits
ALTER TABLE "User" ADD CONSTRAINT "credits_non_negative" CHECK (credits >= 0);
