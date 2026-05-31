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

      // Find the purchase associated with this payment
      const purchases = await db.purchase.findMany({
        where: { stripePaymentId: paymentIntentId },
      });

      if (purchases.length === 0) {
        log.warn("No purchase found for refunded payment", { paymentIntentId });
        break;
      }

      // stripePaymentId is @unique — at most 1 row
      const purchase = purchases[0];
      if (!purchase) break;

      // Revoke credits atomically — may go negative if already spent
      await db.$transaction(async (tx) => {
        // Check idempotency: skip if already refunded
        const current = await tx.purchase.findUnique({
          where: { id: purchase.id },
          select: { refundedAt: true },
        });

        if (current?.refundedAt) {
          log.info("Duplicate refund event, skipping", { purchaseId: purchase.id });
          return;
        }

        await tx.user.update({
          where: { id: purchase.userId },
          data: { credits: { decrement: purchase.creditsPurchased } },
        });

        await tx.purchase.update({
          where: { id: purchase.id },
          data: { refundedAt: new Date() },
        });
      });

      log.info("Credits revoked after refund", {
        userId: purchase.userId,
        credits: purchase.creditsPurchased,
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

      // Flag the purchase as disputed (don't revoke credits yet)
      const disputePurchases = await db.purchase.findMany({
        where: { stripePaymentId: disputePaymentIntent },
      });

      for (const purchase of disputePurchases) {
        await db.purchase.update({
          where: { id: purchase.id },
          data: { disputedAt: new Date() },
        });

        log.warn("Chargeback/dispute on purchase", {
          userId: purchase.userId,
          purchaseId: purchase.id,
          disputeId: dispute.id,
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

      const closedPurchases = await db.purchase.findMany({
        where: { stripePaymentId: disputePaymentIntent },
      });

      if (closedPurchases.length === 0) {
        log.warn("No purchase found for closed dispute", { disputePaymentIntent });
        break;
      }

      for (const purchase of closedPurchases) {
        if (dispute.status === "lost" || dispute.status === "warning_closed") {
          // Dispute perdu contre le marchand — révoquer les crédits
          // Peut passer en négatif si déjà dépensés (même pattern que charge.refunded)
          await db.$transaction(async (tx) => {
            // Vérifier l'idempotence : ignorer si déjà refunded
            const current = await tx.purchase.findUnique({
              where: { id: purchase.id },
              select: { refundedAt: true },
            });

            if (current?.refundedAt) {
              log.info("Already refunded, skipping dispute loss revocation", {
                purchaseId: purchase.id,
              });
              return;
            }

            await tx.user.update({
              where: { id: purchase.userId },
              data: { credits: { decrement: purchase.creditsPurchased } },
            });

            await tx.purchase.update({
              where: { id: purchase.id },
              data: { refundedAt: new Date() },
            });
          });

          log.error("Credits revoked after dispute lost", {
            userId: purchase.userId,
            credits: purchase.creditsPurchased,
            disputeId: dispute.id,
          });
        } else if (dispute.status === "won") {
          // Dispute gagné — effacer le flag disputedAt
          await db.purchase.update({
            where: { id: purchase.id },
            data: { disputedAt: null },
          });

          log.info("Dispute won, cleared disputedAt flag", {
            userId: purchase.userId,
            purchaseId: purchase.id,
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
