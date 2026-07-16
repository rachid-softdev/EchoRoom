import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { env } from "@/lib/env";
import { protectedProcedure, router } from "../procedures";
import { userBillingRepository } from "../repositories";
import { createCheckoutSession } from "../services/billing/stripe";

export const billingRouter = router({
  getCredits: protectedProcedure.query(async ({ ctx }) => {
    // Prefer UserBilling sub-aggregate, fall back to legacy User.credits
    const billing = await userBillingRepository.findByUserId(ctx.session.user.id);

    if (billing) {
      return { credits: billing.credits };
    }

    return { credits: 0 };
  }),

  getPurchases: protectedProcedure.query(async ({ ctx }) => {
    const purchases = await userBillingRepository.getPurchaseHistory(ctx.session.user.id);
    return purchases;
  }),

  createCheckout: protectedProcedure
    .input(
      z.object({
        tier: z.enum(["free", "starter", "pro", "ultra"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // "free" is not a purchasable tier — there is nothing to check out.
      if (input.tier === "free") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Le palier gratuit ne nécessite aucun paiement.",
        });
      }

      const origin = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      const session = await createCheckoutSession({
        userId: ctx.session.user.id,
        tier: input.tier,
        successUrl: `${origin}/billing?success=true`,
        cancelUrl: `${origin}/billing?cancelled=true`,
      });

      return { url: session.url };
    }),
});
