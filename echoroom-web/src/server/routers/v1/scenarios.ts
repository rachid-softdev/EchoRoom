/**
 * v1 Scenarios Router — frozen API contract.
 *
 * This router is a snapshot of the scenarios router at the time of versioning.
 * It maintains backward compatibility for clients that depend on the v1 shapes.
 * Changes and improvements should go into v2+ routers.
 */
import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  withRateLimit,
  withContentModeration,
  withIPRateLimit,
} from "../../procedures";
import { withREDMetrics } from "../../middleware/metrics";
import { db } from "../../db";
import { scheduleAsyncModeration } from "../../services/ai/asyncModeration";
import { getCachedFeed, setCachedFeed, invalidateFeedCache } from "../../services/cache/scenarioCache";
import { redis } from "@/lib/redis";

export const scenariosV1Router = router({
  create: protectedProcedure
    .use(withREDMetrics)
    .use(withRateLimit({ limit: 10, window: 3600 }))
    .use(withContentModeration)
    .input(
      z.object({
        characterId: z.string(),
        title: z.string().min(3).max(80),
        description: z.string().max(300),
        openingMessage: z.string().max(300),
        aiInstructions: z.string().max(3000),
        visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const scenario = await db.scenario.create({
        data: {
          characterId: input.characterId,
          title: input.title,
          description: input.description,
          openingMessage: input.openingMessage,
          aiInstructions: input.aiInstructions,
          visibility: input.visibility,
          creatorId: ctx.session.user.id,
        },
      });

      void invalidateFeedCache();

      const changedText = [input.title, input.description, input.openingMessage, input.aiInstructions]
        .filter(Boolean)
        .join(" ");
      void scheduleAsyncModeration(changedText, { type: "scenario", id: scenario.id });

      return { scenarioId: scenario.id };
    }),

  feed: publicProcedure
    .use(withREDMetrics)
    .use(withIPRateLimit({ limit: 60, window: 60 }))
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(20).default(10),
        sort: z.enum(["CHRONOLOGICAL", "TRENDING", "TOP"]).default("CHRONOLOGICAL"),
      }),
    )
    .query(async ({ input }) => {
      if (!input.cursor && redis) {
        const cacheParams = { sort: input.sort, limit: input.limit };
        const cached = await getCachedFeed<{
          items: Array<Record<string, unknown>>;
          nextCursor: string | undefined;
        }>(cacheParams);
        if (cached) return cached;
      }

      const orderBy =
        input.sort === "TOP" ? { likeCount: "desc" as const } : { createdAt: "desc" as const };

      const effectiveLimit = input.sort === "TRENDING" ? 50 : input.limit + 1;

      const scenarios = await db.scenario.findMany({
        where: {
          visibility: "PUBLIC",
          moderationStatus: "APPROVED",
        },
        take: effectiveLimit,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy,
        include: {
          creator: {
            select: { id: true, username: true, image: true },
          },
          character: {
            select: { id: true, name: true, slug: true, avatarUrl: true, category: true },
          },
          _count: {
            select: { reactions: true, comments: true },
          },
        },
      });

      let items = scenarios.slice(0, input.limit);

      if (input.sort === "TRENDING") {
        const now = Date.now();
        items = [...items].sort((a, b) => {
          const scoreA =
            a.likeCount * 2 +
            a.playCount * 1 +
            a._count.comments * 3 -
            (now - new Date(a.createdAt).getTime()) / (1000 * 60 * 60) * 0.5;
          const scoreB =
            b.likeCount * 2 +
            b.playCount * 1 +
            b._count.comments * 3 -
            (now - new Date(b.createdAt).getTime()) / (1000 * 60 * 60) * 0.5;
          return scoreB - scoreA;
        });
      }

      const nextCursor =
        scenarios.length > input.limit ? items[items.length - 1]?.id : undefined;

      if (!input.cursor && redis) {
        const cacheParams = { sort: input.sort, limit: input.limit };
        void setCachedFeed(cacheParams, { items, nextCursor });
      }

      return { items, nextCursor };
    }),

  getById: publicProcedure
    .use(withIPRateLimit({ limit: 120, window: 60 }))
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role;

      const permissionConditions: Array<Record<string, unknown>> = [
        { visibility: "PUBLIC", moderationStatus: "APPROVED" },
      ];

      if (userId) {
        permissionConditions.push({ creatorId: userId });
      }

      if (userRole === "ADMIN" || userRole === "MODERATOR") {
        permissionConditions.push({});
      }

      const scenario = await db.scenario.findFirst({
        where: {
          id: input.id,
          OR: permissionConditions,
        },
        include: {
          creator: { select: { id: true, username: true, image: true } },
          character: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatarUrl: true,
              category: true,
            },
          },
          reactions: { select: { emoji: true, userId: true } },
          _count: { select: { comments: true, reactions: true } },
        },
      });

      return scenario ?? null;
    }),
});
