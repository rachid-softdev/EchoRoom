import type { PrismaClient } from "@prisma/client";
import { AppError } from "@/server/lib/errors";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends"
>;

/**
 * Atomically increments the daily call count and duration for a user.
 * Uses updateMany with WHERE callCount < maxLimit and
 * totalDurationSeconds < maxDurationSeconds to ensure atomicity
 * under concurrent requests. Falls back to creating a new row if
 * none exists, retrying on unique constraint violation (another
 * transaction created the row first).
 *
 * Must be called inside a Prisma $transaction callback.
 */
export async function atomicIncrementDailyLimit(
  tx: TransactionClient,
  params: {
    userId: string;
    date: Date;
    maxLimit: number;
    maxDurationSeconds?: number;
    currentCallDurationSeconds?: number;
  },
): Promise<void> {
  const effectiveMaxDuration = params.maxDurationSeconds ?? 36000;
  const duration = params.currentCallDurationSeconds ?? 0;

  // Build WHERE condition: if currentCallDurationSeconds provided, enforce duration limit
  const whereExtra =
    params.currentCallDurationSeconds !== undefined
      ? { totalDurationSeconds: { lt: effectiveMaxDuration } }
      : {};

  // Try to atomically increment if under limit
  const result = await tx.dailyCallLimit.updateMany({
    where: {
      userId: params.userId,
      date: params.date,
      callCount: { lt: params.maxLimit },
      ...whereExtra,
    },
    data: {
      callCount: { increment: 1 },
      totalDurationSeconds: { increment: duration },
    },
  });

  if (result.count === 0) {
    // Either no row exists or limit(s) already reached
    try {
      await tx.dailyCallLimit.create({
        data: {
          userId: params.userId,
          date: params.date,
          callCount: 1,
          totalDurationSeconds: duration,
        },
      });
    } catch (e) {
      // P2002 = unique constraint violation means another tx created the row first
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
        const retryWhereExtra =
          params.currentCallDurationSeconds !== undefined
            ? { totalDurationSeconds: { lt: effectiveMaxDuration } }
            : {};

        const retry = await tx.dailyCallLimit.updateMany({
          where: {
            userId: params.userId,
            date: params.date,
            callCount: { lt: params.maxLimit },
            ...retryWhereExtra,
          },
          data: {
            callCount: { increment: 1 },
            totalDurationSeconds: { increment: duration },
          },
        });
        if (retry.count === 0) {
          throw new AppError(
            "DAILY_LIMIT_EXCEEDED",
            "Limite quotidienne de durée d'appels atteinte",
          );
        }
      } else {
        throw e;
      }
    }
  }
}
