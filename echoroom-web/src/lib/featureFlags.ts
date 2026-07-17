import { TRPCError } from "@trpc/server";
import { middleware } from "@/server/trpc";
import { isFeatureEnabled } from "@/config/featureFlags";
import type { FeatureFlagId } from "@/config/featureFlags";
import type { PlanTier } from "@/config/pricing";
import { prismaPlanToTier } from "@/config/pricing";
import { db } from "@/server/db";

export { isFeatureEnabled, FEATURE_FLAGS } from "@/config/featureFlags";
export type {
  FeatureFlagId,
  FeatureFlagConfig,
  FeatureContext,
} from "@/config/featureFlags";
export type { PlanTier } from "@/config/pricing";

/**
 * Resolves the caller's current plan tier by reading the persisted plan on
 * their `UserBilling` record (defaults to "free" when no billing row exists).
 */
export type TierResolver = (userId: string) => Promise<PlanTier>;

const defaultTierResolver: TierResolver = async (userId) => {
  const billing = await db.userBilling.findUnique({
    where: { userId },
    select: { plan: true },
  });
  return prismaPlanToTier(billing?.plan ?? "FREE");
};

/**
 * tRPC middleware factory. Throws `FORBIDDEN` when `flag` is disabled for the
 * caller's resolved tier, `UNAUTHORIZED` when not authenticated.
 *
 * Server usage example:
 *   import { protectedProcedure } from "@/server/procedures";
 *   import { requireFeature } from "@/lib/featureFlags";
 *
 *   apiKeysRoute: protectedProcedure
 *     .use(requireFeature("betaApiAccess"))
 *     .query(({ ctx }) => listApiKeys(ctx.session.user.id)),
 *
 * UI gating example (client — import the isomorphic helper from config):
 *   import { isFeatureEnabled } from "@/config/featureFlags";
 *   // userTier comes from a tRPC query (e.g. user.tier)
 *   {isFeatureEnabled("betaMultiplayerRooms", { tier: userTier }) && (
 *     <MultiplayerRoomsButton />
 *   )}
 */
export function requireFeature(
  flag: FeatureFlagId,
  resolveTier: TierResolver = defaultTierResolver,
) {
  return middleware(async ({ ctx, next }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Vous devez être connecté pour accéder à cette fonctionnalité",
      });
    }
    const tier = await resolveTier(userId);
    if (!isFeatureEnabled(flag, { tier, userId })) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `La fonctionnalité « ${flag} » n'est pas disponible pour votre palier.`,
      });
    }
    return next();
  });
}
