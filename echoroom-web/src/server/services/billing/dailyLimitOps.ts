import type { PrismaClient } from "@prisma/client";
import { AppError } from "@/server/lib/errors";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends"
>;

/**
 * Atomically increments the daily call count for a user.
 * Uses updateMany with WHERE callCount < maxLimit to ensure
 * atomicity under concurrent requests. Falls back to creating
 * a new row if none exists, retrying on unique constraint
 * violation (another transaction created the row first).
 *
 * Must be called inside a Prisma $transaction callback.
 */
export async function atomicIncrementDailyLimit(
  tx: TransactionClient,
  params: { userId: string; date: Date; maxLimit: number },
): Promise<void> {
  // Try to atomically increment if under limit
  const result = await tx.dailyCallLimit.updateMany({
    where: {
      userId: params.userId,
      date: params.date,
      callCount: { lt: params.maxLimit },
    },
    data: { callCount: { increment: 1 } },
  });

  if (result.count === 0) {
    // Either no row exists or limit already reached
    try {
      await tx.dailyCallLimit.create({
        data: {
          userId: params.userId,
          date: params.date,
          callCount: 1,
        },
      });
    } catch (e) {
      // P2002 = unique constraint violation means another tx created the row first
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
        const retry = await tx.dailyCallLimit.updateMany({
          where: {
            userId: params.userId,
            date: params.date,
            callCount: { lt: params.maxLimit },
          },
          data: { callCount: { increment: 1 } },
        });
        if (retry.count === 0) {
          throw new AppError(
            "DAILY_LIMIT_EXCEEDED",
            "Limite quotidienne d'appels atteinte (10/jour)",
          );
        }
      } else {
        throw e;
      }
    }
  }
}
