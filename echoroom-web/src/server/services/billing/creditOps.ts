import type { PrismaClient } from "@prisma/client";
import { AppError } from "@/server/lib/errors";

export interface AtomicDebitSuccess {
  debited: true;
}

export interface AtomicDebitFailure {
  debited: false;
  reason: "INSUFFICIENT_CREDITS" | "USER_NOT_FOUND";
}

export type AtomicDebitResult = AtomicDebitSuccess | AtomicDebitFailure;

/**
 * Atomically debits credits from a user.
 * Uses Prisma updateMany with WHERE credits >= cost condition
 * to ensure atomicity — no separate check needed.
 *
 * Must be called inside a Prisma $transaction callback.
 */
export async function atomicDebit(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends">,
  params: { userId: string; cost: number },
): Promise<AtomicDebitResult> {
  const result = await tx.user.updateMany({
    where: {
      id: params.userId,
      credits: { gte: params.cost },
    },
    data: {
      credits: { decrement: params.cost },
    },
  });

  if (result.count === 0) {
    // Either user doesn't exist or insufficient credits — check which
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { id: true },
    });
    return {
      debited: false,
      reason: user ? "INSUFFICIENT_CREDITS" : "USER_NOT_FOUND",
    };
  }

  return { debited: true };
}

export async function atomicRefund(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends">,
  params: { userId: string; amount: number },
): Promise<void> {
  if (params.amount <= 0) {
    throw new AppError("BAD_REQUEST", "Le montant du remboursement doit être positif");
  }
  await tx.user.update({
    where: { id: params.userId },
    data: { credits: { increment: params.amount } },
  });
}

/**
 * Atomically decrements credits with safety check.
 * Unlike atomicDebit which returns a result, this throws if insufficient.
 * Uses updateMany with WHERE credits >= amount to prevent going below 0.
 */
export async function atomicSafeDecrement(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends">,
  params: { userId: string; amount: number },
): Promise<void> {
  if (params.amount <= 0) {
    throw new AppError("BAD_REQUEST", "Le montant du débit doit être positif");
  }

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
