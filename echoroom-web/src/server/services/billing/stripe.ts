import { stripe } from "@/lib/stripe";

export async function createCheckoutSession(params: {
  userId: string;
  credits: number;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
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
