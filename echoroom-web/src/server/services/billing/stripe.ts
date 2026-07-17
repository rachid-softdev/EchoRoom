import { stripe } from "@/lib/stripe";
import { PRICING_CONFIG, type PlanTier } from "@/config/pricing";

export async function createCheckoutSession(params: {
  userId: string;
  tier: PlanTier;
  successUrl: string;
  cancelUrl: string;
}) {
  const tierConfig = PRICING_CONFIG.find((t) => t.id === params.tier);
  if (!tierConfig) {
    throw new Error(`Palier de facturation inconnu : ${params.tier}`);
  }
  // "free" has no purchasable price — callers must not request checkout for it.
  if (!tierConfig.stripePriceId) {
    throw new Error(`Aucun prix Stripe configuré pour le palier ${params.tier}`);
  }

  // Starter/Pro/Ultra are recurring monthly subscriptions. The tier's
  // included credits are granted via the subscription webhook, not at checkout.
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: tierConfig.stripePriceId, quantity: 1 }],
    client_reference_id: params.userId,
    // Propagate userId into the subscription object so subscription webhooks
    // can resolve the owning user (client_reference_id is not present on
    // subscription events, only on the Checkout Session).
    subscription_data: { metadata: { userId: params.userId } },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
}
