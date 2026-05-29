import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("stripe-webhook");

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
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("Stripe webhook signature verification failed", { message });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const creditsStr = session.metadata?.credits;
      if (!userId || !creditsStr) {
        log.error("Missing metadata on checkout session", { sessionId: session.id });
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      const credits = Number.parseInt(creditsStr, 10);
      if (Number.isNaN(credits) || credits <= 0) {
        log.error("Invalid credits value", { creditsStr });
        return NextResponse.json({ error: "Invalid credits" }, { status: 400 });
      }

      // Add credits to user + record the purchase (atomic transaction)
      // Uses callback-based transaction for true atomicity.
      // Idempotency is enforced by the unique constraint on stripePaymentId.
      try {
        await db.$transaction(async (tx) => {
          await tx.purchase.create({
            data: {
              userId,
              stripePaymentId: session.id,
              creditsPurchased: credits,
            },
          });

          await tx.user.update({
            where: { id: userId },
            data: { credits: { increment: credits } },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          // Duplicate stripePaymentId — already processed
          log.info("Duplicate checkout.session.completed, skipped", {
            sessionId: session.id,
          });
          return NextResponse.json({ received: true });
        }
        throw error;
      }

      log.info("Credits added", { credits, userId, sessionId: session.id });
      break;
    }

    case "checkout.session.expired": {
      log.info("Checkout session expired", { sessionId: event.data.object.id });
      break;
    }

    default: {
      log.info("Unhandled Stripe event type", { eventType: event.type });
    }
  }

  return NextResponse.json({ received: true });
}
