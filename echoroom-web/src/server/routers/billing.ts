import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { db } from "../db";
import { createCheckoutSession } from "../services/billing/stripe";
import { env } from "@/lib/env";

export const billingRouter = router({
  getCredits: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { credits: true },
    });

    return { credits: user?.credits ?? 0 };
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
