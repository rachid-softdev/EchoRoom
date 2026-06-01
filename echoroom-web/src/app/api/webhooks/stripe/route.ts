import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";
import { checkWebhookRateLimit } from "../rateLimit";
import { checkIdempotency } from "@/server/middleware/webhookIdempotency";
import { pushToDLQ } from "@/server/middleware/webhookDLQ";

const log = createLogger("stripe-webhook");

export async function POST(req: NextRequest) {
  // Enforce body size limit (100KB for Stripe webhooks)
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > 100_000) {
    return NextResponse.json({ error: "Requête trop volumineuse" }, { status: 413 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!(await checkWebhookRateLimit("stripe:checkout", ip))) {
    return NextResponse.json(
      { error: "Trop de requêtes" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "En-tête stripe-signature manquant" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("Stripe webhook signature verification failed", { message });
    await pushToDLQ("stripe", "unknown", "signature_verification", { bodyLength: body.length }, message);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  // Idempotency check — Redis-backed SET NX with 24h TTL.
  // Prevents double-processing of the same Stripe event.
  // Graceful degradation: if Redis is down, the check returns false
  // (allows processing), and downstream DB constraints still protect
  // against duplicates.
  if (await checkIdempotency(event.id)) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const creditsStr = session.metadata?.credits;
      if (!userId || !creditsStr) {
        log.error("Missing metadata on checkout session", { sessionId: session.id });
        return NextResponse.json({ error: "Métadonnées manquantes" }, { status: 400 });
      }

      const credits = Number.parseInt(creditsStr, 10);
      if (Number.isNaN(credits) || credits <= 0) {
        log.error("Invalid credits value", { creditsStr });
        return NextResponse.json({ error: "Crédits invalides" }, { status: 400 });
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
        return NextResponse.json({ error: "payment_intent manquant" }, { status: 400 });
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

          // Update UserBilling sub-aggregate only (legacy User.credits is deprecated)
          await tx.userBilling.upsert({
            where: { userId },
            create: { userId, credits },
            update: { credits: { increment: credits } },
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

      // Atomic: only one concurrent webhook will match this WHERE.
      // Using updateMany with refundedAt: null ensures idempotency
      // even under concurrent Stripe webhook delivery.
      // Wrapped in $transaction to ensure marker update + credit
      // revocation are committed atomically — no partial state on crash.
      await db.$transaction(async (tx) => {
        const updated = await tx.purchase.updateMany({
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
          return;
        }

        const purchase = await tx.purchase.findUnique({
          where: { stripePaymentId: paymentIntentId },
          select: { userId: true, creditsPurchased: true },
        });

        if (purchase) {
          await tx.userBilling.upsert({
            where: { userId: purchase.userId },
            create: { userId: purchase.userId },
            update: { credits: { decrement: purchase.creditsPurchased } },
          });
        }

        log.info("Credits revoked after refund", {
          paymentIntentId,
          chargeId: charge.id,
        });
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

      // Atomic idempotent flag wrapped in $transaction for consistency
      await db.$transaction(async (tx) => {
        const updated = await tx.purchase.updateMany({
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
      });
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
        // Atomic: only one concurrent webhook will match this WHERE.
        // Wrapped in $transaction for atomic marker + credit revocation.
        await db.$transaction(async (tx) => {
          const updated = await tx.purchase.updateMany({
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
            return;
          }

          const purchase = await tx.purchase.findUnique({
            where: { stripePaymentId: disputePaymentIntent },
            select: { userId: true, creditsPurchased: true },
          });

          if (purchase) {
            await tx.userBilling.upsert({
              where: { userId: purchase.userId },
              create: { userId: purchase.userId },
              update: { credits: { decrement: purchase.creditsPurchased } },
            });
          }

          log.error("Credits revoked after dispute lost", {
            paymentIntent: disputePaymentIntent,
            disputeId: dispute.id,
          });
        });
      } else if (dispute.status === "won") {
        // Atomic: wrapped in $transaction for consistency with other dispute handlers
        await db.$transaction(async (tx) => {
          const updated = await tx.purchase.updateMany({
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
        });
      }
      break;
    }

    default: {
      log.info("Unhandled Stripe event type", { eventType: event.type });
    }
  }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Unhandled error processing Stripe webhook", { eventType: event.type, error: message });
    await pushToDLQ("stripe", event.id, event.type, event, message);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
