import type { PrismaClient } from "@prisma/client";
import { AppError } from "@/server/lib/errors";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends"
>;

export interface AtomicDebitSuccess {
  debited: true;
}

export interface AtomicDebitFailure {
  debited: false;
  reason: "INSUFFICIENT_CREDITS" | "USER_NOT_FOUND";
}

export type AtomicDebitResult = AtomicDebitSuccess | AtomicDebitFailure;

/**
 * Atomically debits credits from a user via UserBilling.
 * Falls back to legacy User.credits if UserBilling record doesn't exist yet.
 *
 * Must be called inside a Prisma $transaction callback.
 */
export async function atomicDebit(
  tx: TransactionClient,
  params: { userId: string; cost: number },
): Promise<AtomicDebitResult> {
  // Prefer UserBilling sub-aggregate
  const result = await tx.userBilling.updateMany({
    where: {
      userId: params.userId,
      credits: { gte: params.cost },
    },
    data: {
      credits: { decrement: params.cost },
    },
  });

  if (result.count > 0) {
    return { debited: true };
  }

  // Fallback: try legacy User.credits
  const legacyResult = await tx.user.updateMany({
    where: {
      id: params.userId,
      credits: { gte: params.cost },
    },
    data: {
      credits: { decrement: params.cost },
    },
  });

  if (legacyResult.count > 0) {
    return { debited: true };
  }

  // Check if user exists at all
  const user = await tx.user.findUnique({
    where: { id: params.userId },
    select: { id: true },
  });
  return {
    debited: false,
    reason: user ? "INSUFFICIENT_CREDITS" : "USER_NOT_FOUND",
  };
}

export async function atomicRefund(
  tx: TransactionClient,
  params: { userId: string; amount: number },
): Promise<void> {
  if (params.amount <= 0) {
    throw new AppError("BAD_REQUEST", "Le montant du remboursement doit être positif");
  }

  // Prefer UserBilling sub-aggregate
  const billing = await tx.userBilling.findUnique({
    where: { userId: params.userId },
    select: { id: true },
  });

  if (billing) {
    await tx.userBilling.update({
      where: { userId: params.userId },
      data: { credits: { increment: params.amount } },
    });
    return;
  }

  // Fallback: legacy User.credits
  await tx.user.update({
    where: { id: params.userId },
    data: { credits: { increment: params.amount } },
  });
}

/**
 * Atomically decrements credits with safety check.
 * Prefers UserBilling sub-aggregate, falls back to legacy User.credits.
 */
export async function atomicSafeDecrement(
  tx: TransactionClient,
  params: { userId: string; amount: number },
): Promise<void> {
  if (params.amount <= 0) {
    throw new AppError("BAD_REQUEST", "Le montant du débit doit être positif");
  }

  // Try UserBilling first
  const billingResult = await tx.userBilling.updateMany({
    where: {
      userId: params.userId,
      credits: { gte: params.amount },
    },
    data: {
      credits: { decrement: params.amount },
    },
  });

  if (billingResult.count > 0) return;

  // Fallback: legacy User.credits
  const result = await tx.user.updateMany({
    where: {
      id: params.userId,
      credits: { gte: params.amount },
    },
    data: {
      credits: { decrement: params.amount },
    },
  });

  if (result.count === 0) {
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { id: true },
    });
    if (!user) {
      throw new AppError("USER_NOT_FOUND", "Utilisateur introuvable");
    }
    throw new AppError("INSUFFICIENT_CREDITS", "Crédits insuffisants");
  }
}
