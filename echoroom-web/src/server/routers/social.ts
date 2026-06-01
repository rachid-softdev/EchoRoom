import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "../db";
import { checkAndAwardBadges } from "../services/social/badges";
import { createClip, deleteClip, getClips } from "../services/social/clips";
import { getTopCreators, getTopScenarios } from "../services/social/leaderboard";
import {
  protectedProcedure,
  publicProcedure,
  router,
  withIPRateLimit,
  withRateLimit,
} from "../trpc";

export const socialRouter = router({
  toggleLike: protectedProcedure
    .use(withRateLimit({ limit: 60, window: 3600 }))
    .input(
      z.object({
        scenarioId: z.string().min(1, "Scénario requis"),
        emoji: z.string().min(1, "Emoji requis").max(10, "Maximum 10 caractères"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

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

        await db.$transaction(async (tx) => {
          await tx.reaction.delete({ where: { id: existing.id } });
          await tx.scenario.update({
            where: { id: input.scenarioId },
            data: { likeCount: { decrement: 1 } },
          });
          // Update UserSocial sub-aggregate
          await tx.userSocial.upsert({
            where: { userId: scenario.creatorId },
            create: { userId: scenario.creatorId },
            update: { totalLikesReceived: { decrement: 1 } },
          });
        });

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

      await db.$transaction(async (tx) => {
        await tx.reaction.create({
          data: { userId, scenarioId: input.scenarioId, emoji: input.emoji },
        });
        await tx.scenario.update({
          where: { id: input.scenarioId },
          data: { likeCount: { increment: 1 } },
        });
        // Update UserSocial sub-aggregate
        await tx.userSocial.upsert({
          where: { userId: scenario.creatorId },
          create: { userId: scenario.creatorId, totalLikesReceived: 1 },
          update: { totalLikesReceived: { increment: 1 } },
        });
      });

      // Check if the scenario creator earned a badge (outside transaction)
      const newBadge = await checkAndAwardBadges(scenario.creatorId, "LIKE_RECEIVED");

      return { reacted: true, emoji: input.emoji, newBadge };
    }),

  getReactions: publicProcedure
    .use(withIPRateLimit({ limit: 60, window: 60 }))
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
        userId: ctx.session.user.id,
        title: input.title,
        startTime: input.startTime,
        endTime: input.endTime,
      });
    }),

  getClips: protectedProcedure
    .use(withIPRateLimit({ limit: 60, window: 60 }))
    .input(z.object({ callId: z.string() }))
    .query(async ({ input, ctx }) => {
      const call = await db.call.findUnique({
        where: { id: input.callId },
        select: { userId: true },
      });
      if (!call) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Appel introuvable" });
      }
      if (call.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Accès refusé" });
      }
      return getClips(input.callId);
    }),

  deleteClip: protectedProcedure
    .input(z.object({ clipId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return deleteClip(input.clipId, ctx.session.user.id);
    }),

  getLeaderboardScenarios: publicProcedure
    .use(withIPRateLimit({ limit: 30, window: 60 }))
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
    .use(withIPRateLimit({ limit: 30, window: 60 }))
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

  getBadges: publicProcedure.use(withIPRateLimit({ limit: 60, window: 60 })).query(async () => {
    return db.badge.findMany({
      orderBy: { name: "asc" },
    });
  }),

  getUserBadges: publicProcedure
    .use(withIPRateLimit({ limit: 60, window: 60 }))
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

  getFeatured: publicProcedure.use(withIPRateLimit({ limit: 60, window: 60 })).query(async () => {
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

  trackShare: protectedProcedure
    .use(withRateLimit({ limit: 60, window: 3600 }))
    .use(withIPRateLimit({ limit: 30, window: 60 }))
    .input(
      z.object({
        scenarioId: z.string(),
        platform: z.enum(["DISCORD", "TWITTER", "TIKTOK", "COPY_LINK", "WEB_SHARE"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const scenario = await db.scenario.findUnique({
        where: { id: input.scenarioId },
        select: { id: true },
      });
      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scénario introuvable" });
      }
      await db.shareEvent.create({
        data: {
          scenarioId: input.scenarioId,
          platform: input.platform,
          userId: ctx.session.user.id,
        },
      });
      return { success: true };
    }),
});
