import type { PrismaClient } from "@prisma/client";

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
  await tx.user.update({
    where: { id: params.userId },
    data: { credits: { increment: params.amount } },
  });
}
