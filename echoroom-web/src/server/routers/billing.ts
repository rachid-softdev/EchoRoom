import { z } from "zod";
import { router, protectedProcedure } from "../procedures";
import { createCheckoutSession } from "../services/billing/stripe";
import { env } from "@/lib/env";
import { userBillingRepository } from "../repositories";

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
        priceId: z.string(),
        credits: z.number().min(1).max(10000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const origin = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      const session = await createCheckoutSession({
        userId: ctx.session.user.id,
        credits: input.credits,
        priceId: input.priceId,
        successUrl: `${origin}/billing?success=true`,
        cancelUrl: `${origin}/billing?cancelled=true`,
      });

      return { url: session.url };
    }),
});
