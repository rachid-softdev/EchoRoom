/**
 * v1 Billing Router — frozen API contract.
 *
 * @deprecated Use the unversioned `billingRouter` router instead.
 *
 * This router is a snapshot of the billing router at the time of versioning.
 * It maintains backward compatibility for clients that depend on the v1 shapes.
 * Changes and improvements should go into v2+ routers.
 */
import { z } from "zod";
import { env } from "@/lib/env";
import { protectedProcedure, router } from "../../procedures";
import { userBillingRepository } from "../../repositories";
import { createCheckoutSession } from "../../services/billing/stripe";

export const billingV1Router = router({
  getCredits: protectedProcedure.query(async ({ ctx }) => {
    // Prefer UserBilling sub-aggregate, fall back to legacy User.credits
    const billing = await userBillingRepository.findByUserId(ctx.session.user.id);

    if (billing) {
      return { credits: billing.credits };
    }

    return { credits: 0 };
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
