import { stripe } from "@/lib/stripe";

const PRICE_TIERS: Record<string, number> = {
  "price_1_credits_10": 10,
  "price_2_credits_50": 50,
  "price_3_credits_200": 200,
};

export async function createCheckoutSession(params: {
  userId: string;
  credits: number;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const expectedCredits = PRICE_TIERS[params.priceId];
  if (expectedCredits === undefined) {
    throw new Error(`Unknown priceId: ${params.priceId}`);
  }
  if (expectedCredits !== params.credits) {
    throw new Error(
      `Credit amount ${params.credits} doesn't match price tier ${params.priceId} (expected ${expectedCredits})`,
    );
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: params.priceId, quantity: 1 }],
    metadata: {
      userId: params.userId,
      credits: String(params.credits),
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
}
