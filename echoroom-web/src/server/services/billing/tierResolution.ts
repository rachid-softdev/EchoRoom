import { db } from "@/server/db";
import { prismaPlanToTier } from "@/config/pricing";
import type { PlanTier } from "@/config/pricing";

/**
 * Resolves the caller's current plan tier from `UserBilling.plan`
 * (the source of truth for plan entitlement).
 *
 * Defaults to "free" when no billing row / plan is present.
 *
 * NOTE: requires the `UserBilling.plan` field from the Prisma schema
 * (owned by the schema-migration agent). Until that field is generated,
 * this module will not type-check.
 */
export async function resolveUserTier(userId: string): Promise<PlanTier> {
  const billing = await db.userBilling.findUnique({
    where: { userId },
    select: { plan: true },
  });
  return prismaPlanToTier(billing?.plan ?? "FREE");
}
