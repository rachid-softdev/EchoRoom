import { z } from "zod";
import { db } from "../db";
import { getUTCDayRange } from "../lib/date";
import { protectedProcedure, router } from "../procedures";
import { userBillingRepository } from "../repositories";

export const dashboardRouter = router({
  /**
   * Aggregated dashboard data — replaces 4 separate tRPC queries
   * (billing.getCredits, calls.history, calls.todayCount, scenarios.myScenarios)
   * with a single server-side procedure that runs all DB queries in parallel.
   */
  getData: protectedProcedure
    .input(
      z
        .object({
          callsLimit: z.number().min(1).max(20).default(5),
          scenariosLimit: z.number().min(1).max(20).default(3),
        })
        .optional()
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { todayStart, todayEnd } = getUTCDayRange();

      // Run all queries in parallel for optimal performance.
      // Each query is independently resilient — if one fails, the rest still return data.
      const [billing, recentCalls, todayCount, scenarios] = await Promise.all([
        userBillingRepository.findByUserId(userId).catch(() => null),
        db.call
          .findMany({
            where: { userId },
            take: input.callsLimit + 1,
            orderBy: { createdAt: "desc" },
            include: {
              scenario: {
                select: {
                  id: true,
                  title: true,
                  character: { select: { name: true, slug: true } },
                },
              },
            },
          })
          .catch(() => []),
        db.call
          .count({
            where: {
              userId,
              createdAt: { gte: todayStart, lte: todayEnd },
            },
          })
          .catch(() => 0),
        db.scenario
          .findMany({
            where: { creatorId: userId },
            take: input.scenariosLimit + 1,
            orderBy: { createdAt: "desc" },
            include: {
              character: {
                select: { id: true, name: true, slug: true, avatarUrl: true, category: true },
              },
              _count: { select: { reactions: true, comments: true } },
            },
          })
          .catch(() => []),
      ]);

      return {
        credits: billing?.credits ?? 0,
        calls: recentCalls.slice(0, input.callsLimit),
        todayCount,
        scenarios: scenarios.slice(0, input.scenariosLimit),
      };
    }),
});
