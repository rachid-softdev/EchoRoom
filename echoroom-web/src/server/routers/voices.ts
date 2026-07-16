import { router, protectedProcedure } from "../procedures";
import { db } from "../db";
import { prismaPlanToTier } from "@/config/pricing";
import { getAvailableVoiceIds } from "@/config/voices";

export const voicesRouter = router({
  /**
   * Returns the ElevenLabs voice IDs the current user is allowed to select.
   *
   * Premium voices are included only when the `betaPremiumVoices` flag is
   * enabled for the user's tier (Ultra only); otherwise they are filtered out,
   * so non-Ultra users can never submit/select a premium voice.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const billing = await db.userBilling?.findUnique({
      where: { userId: ctx.session.user.id },
      select: { plan: true },
    });
    const tier = prismaPlanToTier(billing?.plan ?? null);
    return getAvailableVoiceIds(tier);
  }),
});
