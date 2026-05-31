import { stripe } from "@/lib/stripe";
import { PRICING_CONFIG } from "@/config/pricing";

export async function createCheckoutSession(params: {
  userId: string;
  credits: number;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const tier = PRICING_CONFIG.find((t) => t.stripePriceId === params.priceId);
  if (!tier) {
    throw new Error(`Identifiant de tarif inconnu : ${params.priceId}`);
  }
  if (tier.credits !== params.credits) {
    throw new Error(
      `Le montant de crédits ${params.credits} ne correspond pas au palier ${params.priceId} (attendu ${tier.credits})`,
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
