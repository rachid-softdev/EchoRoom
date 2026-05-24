import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { db } from "@/server/db";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const creditsStr = session.metadata?.credits;
      if (!userId || !creditsStr) {
        console.error("Missing metadata on checkout session", session.id);
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      const credits = Number.parseInt(creditsStr, 10);
      if (Number.isNaN(credits) || credits <= 0) {
        console.error("Invalid credits value", creditsStr);
        return NextResponse.json({ error: "Invalid credits" }, { status: 400 });
      }

      // Add credits to user
      await db.user.update({
        where: { id: userId },
        data: { credits: { increment: credits } },
      });

      // Record the purchase
      await db.purchase.create({
        data: {
          userId,
          stripePaymentId: session.id,
          creditsPurchased: credits,
        },
      });

      console.log(
        `Credits added: +${credits} for user ${userId} (session ${session.id})`,
      );
      break;
    }

    case "checkout.session.expired": {
      console.log("Checkout session expired:", event.data.object.id);
      break;
    }

    default: {
      console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  return NextResponse.json({ received: true });
}
