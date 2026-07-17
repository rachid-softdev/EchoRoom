import { z } from "zod";
import { router, protectedProcedure } from "../procedures";
import { requireFeature } from "@/lib/featureFlags";
import {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
} from "../services/apiKeys";

export const apiKeysRouter = router({
  /**
   * Creates a new API key (Ultra only). The plaintext key is returned ONCE in
   * the response — the caller must display it to the user immediately, as it
   * cannot be recovered afterwards.
   */
  create: protectedProcedure
    .use(requireFeature("betaApiAccess"))
    .input(z.object({ name: z.string().min(1).max(60) }))
    .mutation(async ({ input, ctx }) => {
      const result = await generateApiKey(ctx.session.user.id, input.name);
      return { id: result.id, name: result.name, key: result.key, prefix: result.prefix };
    }),

  /**
   * Lists the caller's active (non-revoked) API keys. NEVER returns key hashes.
   */
  list: protectedProcedure
    .use(requireFeature("betaApiAccess"))
    .query(async ({ ctx }) => {
      return listApiKeys(ctx.session.user.id);
    }),

  /**
   * Revokes an API key owned by the caller.
   */
  revoke: protectedProcedure
    .use(requireFeature("betaApiAccess"))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      await revokeApiKey(ctx.session.user.id, input.id);
      return { success: true };
    }),
});
