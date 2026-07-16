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
    /** When true (e.g. ultra tier), no daily cap is enforced at all. */
    bypassLimit?: boolean;
  },
): Promise<void> {
  const effectiveMaxDuration = params.maxDurationSeconds ?? 36000;
  const duration = params.currentCallDurationSeconds ?? 0;
  const bypass = params.bypassLimit ?? false;

  // Build WHERE condition: if currentCallDurationSeconds provided, enforce duration limit.
  // When bypassLimit is set, neither the call-count nor the duration cap is applied
  // (used by tiers such as ultra that have no daily limit).
  const whereExtra =
    !bypass && params.currentCallDurationSeconds !== undefined
      ? { totalDurationSeconds: { lt: effectiveMaxDuration } }
      : {};

  const countWhere = {
    userId: params.userId,
    date: params.date,
    ...(bypass ? {} : { callCount: { lt: params.maxLimit } }),
    ...whereExtra,
  };

  // Try to atomically increment if under limit
  const result = await tx.dailyCallLimit.updateMany({
    where: countWhere,
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
          !bypass && params.currentCallDurationSeconds !== undefined
            ? { totalDurationSeconds: { lt: effectiveMaxDuration } }
            : {};

        const retry = await tx.dailyCallLimit.updateMany({
          where: {
            userId: params.userId,
            date: params.date,
            ...(bypass ? {} : { callCount: { lt: params.maxLimit } }),
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
