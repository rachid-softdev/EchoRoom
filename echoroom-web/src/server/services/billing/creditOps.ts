import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
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
 * Atomically debits credits from a user via UserBilling sub-aggregate only.
 *
 * Must be called inside a Prisma $transaction callback.
 */
export async function atomicDebit(
  tx: TransactionClient,
  params: { userId: string; cost: number },
): Promise<AtomicDebitResult> {
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

  // Refund via UserBilling sub-aggregate only (legacy User.credits is deprecated)
  await tx.userBilling.upsert({
    where: { userId: params.userId },
    create: { userId: params.userId, credits: params.amount },
    update: { credits: { increment: params.amount } },
  });
}

/**
 * Atomically decrements credits with safety check.
 * Uses UserBilling sub-aggregate only (legacy User.credits is deprecated).
 */
export async function atomicSafeDecrement(
  tx: TransactionClient,
  params: { userId: string; amount: number },
): Promise<void> {
  if (params.amount <= 0) {
    throw new AppError("BAD_REQUEST", "Le montant du débit doit être positif");
  }

  try {
    const billingResult = await tx.userBilling.updateMany({
      where: {
        userId: params.userId,
        credits: { gte: params.amount },
      },
      data: {
        credits: { decrement: params.amount },
      },
    });

    if (billingResult.count === 0) {
      const user = await tx.user.findUnique({
        where: { id: params.userId },
        select: { id: true },
      });
      if (!user) {
        throw new AppError("USER_NOT_FOUND", "Utilisateur introuvable");
      }
      throw new AppError("INSUFFICIENT_CREDITS", "Crédits insuffisants");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2014") {
      throw new AppError("INSUFFICIENT_CREDITS", "Crédits insuffisants");
    }
    throw error;
  }
}
