import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";
import { checkWebhookRateLimit } from "../rateLimit";

const log = createLogger("stripe-webhook");

export async function POST(req: NextRequest) {
  // Enforce body size limit (100KB for Stripe webhooks)
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > 100_000) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!(await checkWebhookRateLimit("stripe:checkout", ip))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
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
      // Use the Payment Intent ID (pi_xxx) rather than Session ID (cs_xxx)
      // because downstream events (charge.refunded, charge.dispute.created)
      // reference payment_intent, not session.id.
      const paymentIntentId = session.payment_intent as string | null;
      if (!paymentIntentId) {
        log.error("No payment_intent on completed checkout session", { sessionId: session.id });
        return NextResponse.json({ error: "Missing payment_intent" }, { status: 400 });
      }

      try {
        await db.$transaction(async (tx) => {
          await tx.purchase.create({
            data: {
              userId,
              stripePaymentId: paymentIntentId,
              creditsPurchased: credits,
            },
          });

          await tx.user.update({
            where: { id: userId },
            data: { credits: { increment: credits } },
          });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;

      if (!paymentIntentId) {
        log.warn("Refund event without payment_intent", { chargeId: charge.id });
        break;
      }

      // Atomic: only one concurrent webhook will match this WHERE
      // Using updateMany with refundedAt: null ensures idempotency
      // even under concurrent Stripe webhook delivery.
      const updated = await db.purchase.updateMany({
        where: {
          stripePaymentId: paymentIntentId,
          refundedAt: null,
        },
        data: {
          refundedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        log.info("Duplicate or no purchase for refund", { paymentIntentId });
        break;
      }

      const purchase = await db.purchase.findUnique({
        where: { stripePaymentId: paymentIntentId },
        select: { userId: true, creditsPurchased: true },
      });

      if (purchase) {
        await db.user.update({
          where: { id: purchase.userId },
          data: { credits: { decrement: purchase.creditsPurchased } },
        });
      }

      log.info("Credits revoked after refund", {
        paymentIntentId,
        chargeId: charge.id,
      });
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const disputePaymentIntent = dispute.payment_intent as string;

      if (!disputePaymentIntent) {
        log.warn("Dispute without payment_intent", { disputeId: dispute.id });
        break;
      }

      // Atomic idempotent flag — only one webhook will match
      const updated = await db.purchase.updateMany({
        where: {
          stripePaymentId: disputePaymentIntent,
          disputedAt: null,
        },
        data: { disputedAt: new Date() },
      });

      if (updated.count > 0) {
        log.warn("Chargeback/dispute on purchase", {
          paymentIntent: disputePaymentIntent,
          disputeId: dispute.id,
        });
      } else {
        log.info("Duplicate or no purchase for dispute", {
          paymentIntent: disputePaymentIntent,
        });
      }
      break;
    }

    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      const disputePaymentIntent = dispute.payment_intent as string;

      if (!disputePaymentIntent) {
        log.warn("Dispute closed without payment_intent", { disputeId: dispute.id });
        break;
      }

      if (dispute.status === "lost" || dispute.status === "warning_closed") {
        // Atomic: only one concurrent webhook will match this WHERE
        const updated = await db.purchase.updateMany({
          where: {
            stripePaymentId: disputePaymentIntent,
            refundedAt: null,
          },
          data: { refundedAt: new Date() },
        });

        if (updated.count === 0) {
          log.info("Duplicate or no purchase for dispute loss", {
            paymentIntent: disputePaymentIntent,
          });
          break;
        }

        const purchase = await db.purchase.findUnique({
          where: { stripePaymentId: disputePaymentIntent },
          select: { userId: true, creditsPurchased: true },
        });

        if (purchase) {
          await db.user.update({
            where: { id: purchase.userId },
            data: { credits: { decrement: purchase.creditsPurchased } },
          });
        }

        log.error("Credits revoked after dispute lost", {
          paymentIntent: disputePaymentIntent,
          disputeId: dispute.id,
        });
      } else if (dispute.status === "won") {
        // Atomic: clear disputedAt flag (only if currently set)
        const updated = await db.purchase.updateMany({
          where: {
            stripePaymentId: disputePaymentIntent,
            disputedAt: { not: null },
          },
          data: { disputedAt: null },
        });

        if (updated.count > 0) {
          log.info("Dispute won, cleared disputedAt flag", {
            paymentIntent: disputePaymentIntent,
            disputeId: dispute.id,
          });
        }
      }
      break;
    }

    default: {
      log.info("Unhandled Stripe event type", { eventType: event.type });
    }
  }

  return NextResponse.json({ received: true });
}
