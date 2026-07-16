import { Prisma, PlanTier, SubscriptionStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { PRICING_CONFIG, type PlanTier as AppPlanTier } from "@/config/pricing";
import { stripe } from "@/lib/stripe";
import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";
import { checkWebhookRateLimit } from "../rateLimit";
import { isEventProcessed, markEventProcessed } from "@/server/middleware/webhookIdempotency";
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

  // Idempotency probe (read-only). The marker is only *consumed* after the
  // DB writes below commit successfully (outbox pattern) — see markEventProcessed
  // near the end of this handler. This prevents permanently skipping an event
  // on retry when the DB write fails after the marker was already set.
  if (await isEventProcessed(event.id)) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // Subscription-mode checkouts grant their entitlements via the
      // customer.subscription.* webhooks, not as one-shot credit purchases.
      // Skip them here to preserve the one-shot credit path below.
      if (session.mode === "subscription" || session.subscription) {
        log.info("Subscription checkout completed — entitlements handled by subscription webhook", {
          sessionId: session.id,
        });
        break;
      }
      const userId = session.metadata?.["userId"];
      const creditsStr = session.metadata?.["credits"];
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

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = resolveUserIdFromSubscription(subscription);
      if (!userId) {
        log.error("Cannot resolve user for subscription event", {
          subscriptionId: subscription.id,
          eventType: event.type,
        });
        break;
      }

      // Derive the tier from the subscription's price id (source of truth).
      const priceId = subscription.items.data[0]?.price?.id;
      const tier = priceId
        ? PRICING_CONFIG.find((t) => t.stripePriceId === priceId)?.id
        : undefined;
      if (!tier) {
        log.error("Unknown price id on subscription, skipping plan update", {
          subscriptionId: subscription.id,
          priceId,
        });
        break;
      }

      // Stripe status strings are lower_snake_case; the DB Subscription.status
      // is the UPPERCASE Prisma SubscriptionStatus enum.
      const status = subscription.status;
      const prismaStatus = stripeStatusToPrisma(status);

      // Record the subscription state. The upsert is keyed on the Stripe
      // subscription id, so reprocessing the same event is a no-op (idempotent).
      try {
        await db.$transaction(async (tx) => {
          await tx.subscription.upsert({
            where: { stripeSubscriptionId: subscription.id },
            create: {
              userId,
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId!,
              plan: tierToPrismaPlan(tier),
              status: prismaStatus,
              currentPeriodStart: new Date(
                (subscription.current_period_start ?? Math.floor(Date.now() / 1000)) * 1000,
              ),
              currentPeriodEnd: new Date(
                (subscription.current_period_end ?? Math.floor(Date.now() / 1000)) * 1000,
              ),
            },
            update: {
              stripePriceId: priceId!,
              plan: tierToPrismaPlan(tier),
              status: prismaStatus,
            },
          });

          // Active or past_due subscriptions grant the tier's entitlements.
          // Tenant-scoped: only the resolved user's plan is updated, and the
          // monthly credit allowance is (re)seeded for the recurring-credit model.
          if (status === "active" || status === "past_due") {
            await tx.userBilling.update({
              where: { userId },
              data: {
                plan: tierToPrismaPlan(tier),
                credits: PRICING_CONFIG.find((t) => t.id === tier)?.credits ?? 0,
              },
            });
          }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          log.info("Duplicate subscription upsert, skipped", {
            subscriptionId: subscription.id,
          });
          break;
        }
        throw error;
      }

      if (status === "active" || status === "past_due") {
        log.info("Subscription entitlements applied", {
          userId,
          tier,
          status,
          subscriptionId: subscription.id,
        });
      } else {
        // Ended / non-entitling subscription: downgrade to FREE only if no
        // other active subscription remains for this (tenant-scoped) user.
        await downgradeToFreeIfNoActiveSubscription(userId, subscription.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = resolveUserIdFromSubscription(subscription);
      if (!userId) {
        log.error("Cannot resolve user for subscription.deleted event", {
          subscriptionId: subscription.id,
        });
        break;
      }

      // Only downgrade if no other active subscription remains for the user.
      await downgradeToFreeIfNoActiveSubscription(userId, subscription.id);
      log.info("Subscription deleted — evaluated downgrade to free", {
        userId,
        subscriptionId: subscription.id,
      });
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

  // Outbox: only consume the idempotency marker AFTER the DB writes above
  // have committed. If a write failed we returned 500 and the marker stays
  // unset, so Stripe retries and reprocessing is safe (DB constraints still
  // prevent duplicates).
  await markEventProcessed(event.id);

  return NextResponse.json({ received: true });
}

/**
 * Resolves the owning user id for a subscription webhook event.
 *
 * The authoritative source is the `userId` we stamped into the subscription's
 * metadata at checkout (via `subscription_data.metadata`). This keeps the
 * operation tenant-scoped: we never attribute a subscription to a user other
 * than the one who created it. (The Checkout Session's `client_reference_id`
 * is not echoed onto subscription events, so it cannot be used here.)
 */
function resolveUserIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const userId = subscription.metadata?.["userId"];
  return userId && userId.length > 0 ? userId : null;
}

/**
 * Maps the app-level (lowercase) PlanTier to the Prisma PlanTier enum value.
 *
 * Mirrors `prismaPlanToTier()` (Prisma -> app). The Prisma enum members are the
 * tier ids in UPPERCASE (FREE, STARTER, PRO, ULTRA) — see the billing schema.
 * TODO: centralize this conversion next to `prismaPlanToTier()` once the schema
 * agent lands the enum (contract: UserBilling.plan / Subscription.plan).
 */
function tierToPrismaPlan(tier: AppPlanTier): PlanTier {
  return tier.toUpperCase() as PlanTier;
}

/**
 * Downgrades the user to the FREE plan only if they have no other active
 * (ACTIVE/PAST_DUE) subscription. Tenant-scoped to `userId`.
 */
async function downgradeToFreeIfNoActiveSubscription(
  userId: string,
  excludeSubscriptionId: string,
): Promise<void> {
  const active = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "PAST_DUE"] },
      NOT: { stripeSubscriptionId: excludeSubscriptionId },
    },
    select: { id: true },
  });

  // Another active subscription keeps the user's paid entitlements.
  if (active) {
    return;
  }

  await db.userBilling.update({
    where: { userId },
    data: { plan: "FREE" as PlanTier },
  });

  log.info("Downgraded user to FREE plan (no active subscription)", { userId });
}

/**
 * Maps a Stripe subscription status string to the Prisma SubscriptionStatus
 * enum. The enum only defines ACTIVE / PAST_DUE / CANCELED / INCOMPLETE, so
 * transient/terminal Stripe states are approximated to the closest enum value.
 */
function stripeStatusToPrisma(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "cancelled":
    case "incomplete_expired":
    case "unpaid":
      return "CANCELED";
    case "incomplete":
    case "trialing":
      return "INCOMPLETE";
    default:
      return "CANCELED";
  }
}
