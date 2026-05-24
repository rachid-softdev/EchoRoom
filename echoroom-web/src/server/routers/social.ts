import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  publicProcedure,
  protectedProcedure,
  withRateLimit,
} from "../trpc";
import { db } from "../db";
import { checkAndAwardBadges } from "../services/social/badges";
import { getTopScenarios, getTopCreators } from "../services/social/leaderboard";
import { createClip, getClips, deleteClip } from "../services/social/clips";

export const socialRouter = router({
  toggleLike: protectedProcedure
    .use(withRateLimit({ limit: 60, window: 3600 }))
    .input(
      z.object({
        scenarioId: z.string(),
        emoji: z.string().min(1).max(10),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session!.user.id;

      const existing = await db.reaction.findUnique({
        where: {
          userId_scenarioId_emoji: {
            userId,
            scenarioId: input.scenarioId,
            emoji: input.emoji,
          },
        },
      });

      if (existing) {
        // Toggle off: remove reaction and decrement counts
        const scenario = await db.scenario.findUnique({
          where: { id: input.scenarioId },
          select: { creatorId: true },
        });
        if (!scenario) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scénario introuvable",
          });
        }

        await db.$transaction([
          db.reaction.delete({ where: { id: existing.id } }),
          db.scenario.update({
            where: { id: input.scenarioId },
            data: { likeCount: { decrement: 1 } },
          }),
          db.user.update({
            where: { id: scenario.creatorId },
            data: { totalLikesReceived: { decrement: 1 } },
          }),
        ]);

        return { reacted: false, emoji: input.emoji, newBadge: null };
      }

      // Toggle on: create reaction and increment counts
      const scenario = await db.scenario.findUnique({
        where: { id: input.scenarioId },
        select: { creatorId: true },
      });
      if (!scenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scénario introuvable",
        });
      }

      await db.$transaction([
        db.reaction.create({
          data: { userId, scenarioId: input.scenarioId, emoji: input.emoji },
        }),
        db.scenario.update({
          where: { id: input.scenarioId },
          data: { likeCount: { increment: 1 } },
        }),
        db.user.update({
          where: { id: scenario.creatorId },
          data: { totalLikesReceived: { increment: 1 } },
        }),
      ]);

      // Check if the scenario creator earned a badge (outside transaction)
      const newBadge = await checkAndAwardBadges(scenario.creatorId, "LIKE_RECEIVED");

      return { reacted: true, emoji: input.emoji, newBadge };
    }),

  getReactions: publicProcedure
    .input(z.object({ scenarioId: z.string() }))
    .query(async ({ input, ctx }) => {
      const grouped = await db.reaction.groupBy({
        by: ["emoji"],
        where: { scenarioId: input.scenarioId },
        _count: true,
      });

      const userId = ctx.session?.user?.id;
      let userEmojis: string[] = [];
      if (userId) {
        const userReactions = await db.reaction.findMany({
          where: { scenarioId: input.scenarioId, userId },
          select: { emoji: true },
        });
        userEmojis = userReactions.map((r) => r.emoji);
      }

      const userReactedSet = new Set(userEmojis);

      return {
        reactions: grouped.map((r) => ({
          emoji: r.emoji,
          count: r._count,
          userReacted: userReactedSet.has(r.emoji),
        })),
      };
    }),

  createClip: protectedProcedure
    .use(withRateLimit({ limit: 20, window: 3600 }))
    .input(
      z.object({
        callId: z.string(),
        title: z.string().max(100).optional(),
        startTime: z.number().int().min(0),
        endTime: z.number().int().min(0),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return createClip({
        callId: input.callId,
        userId: ctx.session!.user.id,
        title: input.title,
        startTime: input.startTime,
        endTime: input.endTime,
      });
    }),

  getClips: publicProcedure
    .input(z.object({ callId: z.string() }))
    .query(async ({ input }) => {
      return getClips(input.callId);
    }),

  deleteClip: protectedProcedure
    .input(z.object({ clipId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return deleteClip(input.clipId, ctx.session!.user.id);
    }),

  getLeaderboardScenarios: publicProcedure
    .input(
      z.object({
        period: z.enum(["ALL", "WEEK", "MONTH"]).default("ALL"),
        sort: z.enum(["LIKES", "PLAYS"]).default("LIKES"),
      }),
    )
    .query(async ({ input }) => {
      const items = await getTopScenarios({
        period: input.period,
        sort: input.sort,
      });
      return { items };
    }),

  getLeaderboardCreators: publicProcedure
    .input(
      z.object({
        period: z.enum(["ALL", "WEEK", "MONTH"]).default("ALL"),
        sort: z.enum(["LIKES", "CALLS"]).default("LIKES"),
      }),
    )
    .query(async ({ input }) => {
      const items = await getTopCreators({
        period: input.period,
        sort: input.sort,
      });
      return { items };
    }),

  getBadges: publicProcedure.query(async () => {
    return db.badge.findMany({
      orderBy: { name: "asc" },
    });
  }),

  getUserBadges: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const userBadges = await db.userBadge.findMany({
        where: { userId: input.userId },
        include: {
          badge: true,
        },
        orderBy: { awardedAt: "desc" },
      });

      return userBadges.map((ub) => ({
        id: ub.id,
        badge: ub.badge,
        awardedAt: ub.awardedAt,
      }));
    }),

  getFeatured: publicProcedure.query(async () => {
    const featured = await db.featuredScenario.findFirst({
      orderBy: { featuredAt: "desc" },
      include: {
        scenario: {
          include: {
            character: {
              select: { id: true, name: true, slug: true, avatarUrl: true },
            },
            creator: {
              select: { id: true, username: true, image: true },
            },
          },
        },
      },
    });

    return featured?.scenario ?? null;
  }),

  trackShare: publicProcedure
    .use(withRateLimit({ limit: 120, window: 3600 }))
    .input(
      z.object({
        scenarioId: z.string(),
        platform: z.enum(["DISCORD", "TWITTER", "TIKTOK", "COPY_LINK", "WEB_SHARE"]),
      }),
    )
    .mutation(async () => {
      // Tracking is handled by PostHog on the client side
      return { success: true };
    }),
});
