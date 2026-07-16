import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { db } from "../db";
import { withREDMetrics } from "../middleware/metrics";
import {
  protectedProcedure,
  publicProcedure,
  router,
  withContentModeration,
  withIPRateLimit,
  withRateLimit,
} from "../procedures";
import { scheduleAsyncModeration } from "../services/ai/asyncModeration";
import { generateScenarioScript } from "../services/ai/generateScript";
import { checkContentBlocklist } from "../services/ai/moderation";
import { checkAndAwardBadges } from "@/server/services/social/badges";
import {
  getCachedFeed,
  getCachedTrendingFeed,
  invalidateFeedCache,
  setCachedFeed,
  setCachedTrendingFeed,
} from "../services/cache/scenarioCache";
import { detectScenarioSpam } from "../services/security/spamDetection";
import { prismaPlanToTier, tierMeetsMinimum } from "@/config/pricing";
import { sanitizeUserText } from "@/lib/sanitize";

/** Shape of a feed item returned by the scenarios.feed / trending procedures */
type FeedItem = Prisma.ScenarioGetPayload<{
  include: {
    creator: { select: { id: true; username: true; image: true; billing: true } };
    character: { select: { id: true; name: true; slug: true; avatarUrl: true; category: true } };
    _count: { select: { reactions: true; comments: true } };
  };
}>;

/** A feed item augmented with the early-access boost flag (Pro/Ultra creators). */
type FeedItemWithEarlyAccess = FeedItem & { isEarlyAccess: boolean };

/** Feed response shape */
interface FeedResponse {
  items: FeedItemWithEarlyAccess[];
  nextCursor: string | undefined;
}

export const scenariosRouter = router({
  create: protectedProcedure
    .use(withREDMetrics)
    .use(withRateLimit({ limit: 10, window: 3600 }))
    .use(withContentModeration)
    .input(
      z.object({
        characterId: z.string().min(1, "Personnage requis"),
        title: z.string().min(3, "Minimum 3 caractères").max(80, "Maximum 80 caractères"),
        description: z.string().max(300, "Maximum 300 caractères"),
        openingMessage: z.string().max(300, "Maximum 300 caractères"),
        aiInstructions: z.string().max(3000, "Maximum 3000 caractères"),
        visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"], { message: "Visibilité invalide" }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Spam detection
      const spamCheck = await detectScenarioSpam(ctx.session.user.id);
      if (spamCheck.flagged) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: spamCheck.reason ?? "Trop de requêtes",
        });
      }

      // Tier gate: scenario creation requires at least the Starter plan.
      // FREE users are blocked (Starter/Pro/Ultra allowed).
      const billing = await db.userBilling?.findUnique({
        where: { userId: ctx.session.user.id },
      });
      const plan = (billing as { plan?: string } | null)?.plan ?? null;
      const tier = prismaPlanToTier(plan);
      if (tier === "free") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "La création de scénarios nécessite un palier Starter ou plus",
        });
      }

      // XSS hardening: strip any HTML/markup from user-supplied text before persistence.
      const safeTitle = sanitizeUserText(input.title);
      const safeDescription = sanitizeUserText(input.description);
      const safeOpeningMessage = sanitizeUserText(input.openingMessage);
      const safeAiInstructions = sanitizeUserText(input.aiInstructions);

      const scenario = await db.scenario.create({
        data: {
          characterId: input.characterId,
          title: safeTitle,
          description: safeDescription,
          openingMessage: safeOpeningMessage,
          aiInstructions: safeAiInstructions,
          visibility: input.visibility,
          creatorId: ctx.session.user.id,
        },
      });

      // Award first-scenario badge (fire-and-forget; failures must not break creation).
      void checkAndAwardBadges(ctx.session.user.id, "FIRST_SCENARIO");

      void invalidateFeedCache();

      // Schedule async AI moderation (fire-and-forget) on the sanitized text.
      const changedText = [safeTitle, safeDescription, safeOpeningMessage, safeAiInstructions]
        .filter(Boolean)
        .join(" ");
      void scheduleAsyncModeration(changedText, { type: "scenario", id: scenario.id });

      return { scenarioId: scenario.id };
    }),

  generateScript: protectedProcedure
    .use(withRateLimit({ limit: 20, window: 3600 }))
    .input(
      z.object({
        characterId: z.string().min(1, "Personnage requis"),
        title: z.string().min(1, "Titre requis").max(200, "Maximum 200 caractères"),
        description: z.string().min(1, "Description requise").max(500, "Maximum 500 caractères"),
        openingMessage: z
          .string()
          .min(1, "Message d'ouverture requis")
          .max(500, "Maximum 500 caractères"),
      }),
    )
    .mutation(async ({ input }) => {
      const character = await db.character.findUnique({
        where: { id: input.characterId },
        select: { name: true, promptSystem: true },
      });

      if (!character) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Personnage introuvable",
        });
      }

      const result = await generateScenarioScript({
        characterName: character.name,
        characterPrompt: character.promptSystem,
        title: input.title,
        description: input.description,
        openingMessage: input.openingMessage,
      });

      return result;
    }),

  feed: publicProcedure
    .use(withREDMetrics)
    .use(withIPRateLimit({ limit: 60, window: 60 }))
    .input(
      z.object({
        cursor: z.string().min(1, "Curseur invalide").optional(),
        limit: z.number().int().min(1, "Minimum 1").max(20, "Maximum 20").default(10),
        sort: z
          .enum(["CHRONOLOGICAL", "TRENDING", "TOP"], { message: "Tri invalide" })
          .default("CHRONOLOGICAL"),
      }),
    )
    .query(async ({ input }): Promise<FeedResponse> => {
      // Check cache for first page (no cursor)
      if (!input.cursor && redis) {
        const cacheParams = { sort: input.sort, limit: input.limit };
        const cached = await getCachedFeed<FeedResponse>(cacheParams);
        if (cached) return cached;
      }

      const orderBy =
        input.sort === "TOP" ? { likeCount: "desc" as const } : { createdAt: "desc" as const };

      // Cap fetch size for TRENDING sort to avoid in-memory sorting of entire table
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
            select: { id: true, username: true, image: true, billing: true },
          },
          character: {
            select: { id: true, name: true, slug: true, avatarUrl: true, category: true },
          },
          _count: {
            select: { reactions: true, comments: true },
          },
        },
      });

      // Early-access boost: creators on a Pro/Ultra plan get their published
      // scenarios surfaced. Resolve each creator's tier from their billing plan.
      const earlyAccessById = new Map<string, boolean>();
      for (const s of scenarios) {
        const creatorPlan = (s.creator.billing as { plan?: string } | null)?.plan ?? null;
        const isProOrUltra = tierMeetsMinimum(prismaPlanToTier(creatorPlan), "pro");
        earlyAccessById.set(s.creator.id, isProOrUltra);
      }
      const markEarlyAccess = (s: FeedItem): FeedItemWithEarlyAccess => ({
        ...s,
        isEarlyAccess: earlyAccessById.get(s.creator.id) ?? false,
      });

      let items = scenarios.slice(0, input.limit).map(markEarlyAccess);

      // For TRENDING, sort in-memory using a trending score (early-access first).
      if (input.sort === "TRENDING") {
        const now = Date.now();
        items = [...items].sort((a, b) => {
          if (a.isEarlyAccess !== b.isEarlyAccess) return a.isEarlyAccess ? -1 : 1;
          const scoreA =
            a.likeCount * 2 +
            a.playCount * 1 +
            a._count.comments * 3 -
            ((now - new Date(a.createdAt).getTime()) / (1000 * 60 * 60)) * 0.5;
          const scoreB =
            b.likeCount * 2 +
            b.playCount * 1 +
            b._count.comments * 3 -
            ((now - new Date(b.createdAt).getTime()) / (1000 * 60 * 60)) * 0.5;
          return scoreB - scoreA;
        });
      } else {
        // CHRONOLOGICAL / TOP: keep the DB primary order, but float
        // early-access scenarios to the top (secondary sort by isEarlyAccess desc).
        items = [...items].sort((a, b) => {
          if (a.isEarlyAccess !== b.isEarlyAccess) return a.isEarlyAccess ? -1 : 1;
          if (input.sort === "TOP") return b.likeCount - a.likeCount;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }

      const nextCursor = scenarios.length > input.limit ? items[items.length - 1]?.id : undefined;

      // Cache first page (no cursor) for subsequent requests
      if (!input.cursor && redis) {
        const cacheParams = { sort: input.sort, limit: input.limit };
        void setCachedFeed(cacheParams, { items, nextCursor });
      }

      return { items, nextCursor };
    }),

  trending: publicProcedure
    .use(withIPRateLimit({ limit: 30, window: 60 }))
    .input(
      z.object({
        cursor: z.string().min(1, "Curseur invalide").optional(),
        limit: z.number().int().min(1, "Minimum 1").max(20, "Maximum 20").default(10),
      }),
    )
    .query(async ({ input }): Promise<FeedResponse> => {
      // Cache first page (no cursor) for 120s
      if (!input.cursor && redis) {
        const cached = await getCachedTrendingFeed<FeedResponse>({
          limit: input.limit,
          ...(input.cursor ? { cursor: input.cursor } : {}),
        });
        if (cached) return cached;
      }

      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

      // Batch 48h aggregate counts
      const [reactionCounts, callCounts, commentCounts] = await Promise.all([
        db.reaction.groupBy({
          by: ["scenarioId"],
          where: {
            createdAt: { gte: fortyEightHoursAgo },
            scenario: { visibility: "PUBLIC", moderationStatus: "APPROVED" },
          },
          _count: { id: true },
        }),
        db.call.groupBy({
          by: ["scenarioId"],
          where: {
            createdAt: { gte: fortyEightHoursAgo },
            scenarioId: { not: null },
            scenario: { visibility: "PUBLIC", moderationStatus: "APPROVED" },
          },
          _count: { id: true },
        }),
        db.comment.groupBy({
          by: ["scenarioId"],
          where: {
            createdAt: { gte: fortyEightHoursAgo },
            scenario: { visibility: "PUBLIC", moderationStatus: "APPROVED" },
          },
          _count: { id: true },
        }),
      ]);

      const reactionMap = new Map(reactionCounts.map((r) => [r.scenarioId, r._count.id]));
      const callMap = new Map(callCounts.map((c) => [c.scenarioId, c._count.id]));
      const commentMap = new Map(commentCounts.map((c) => [c.scenarioId, c._count.id]));

      // Over-fetch to allow in-memory scoring
      const FETCH_CAP = 50;

      const scenarios = await db.scenario.findMany({
        where: {
          visibility: "PUBLIC",
          moderationStatus: "APPROVED",
        },
        take: FETCH_CAP,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: { id: true, username: true, image: true, billing: true },
          },
          character: {
            select: { id: true, name: true, slug: true, avatarUrl: true, category: true },
          },
          _count: {
            select: { reactions: true, comments: true },
          },
        },
      });

      const now = Date.now();
      const withScore = scenarios.map((s) => {
        const likes48h = reactionMap.get(s.id) ?? 0;
        const plays48h = callMap.get(s.id) ?? 0;
        const comments48h = commentMap.get(s.id) ?? 0;
        const hoursSinceCreation =
          (now - s.createdAt.getTime()) / (1000 * 60 * 60);
        const score =
          likes48h * 3 + plays48h * 1 + comments48h * 2 - hoursSinceCreation * 0.5;
        // Early-access flag: Pro/Ultra creators get surfaced.
        const creatorPlan = (s.creator.billing as { plan?: string } | null)?.plan ?? null;
        const isEarlyAccess = tierMeetsMinimum(prismaPlanToTier(creatorPlan), "pro");
        return { ...s, score, isEarlyAccess };
      });
      // Early-access scenarios float to the top, then by trending score.
      withScore.sort((a, b) => {
        if (a.isEarlyAccess !== b.isEarlyAccess) return a.isEarlyAccess ? -1 : 1;
        return b.score - a.score;
      });

      const items: FeedItemWithEarlyAccess[] = withScore
        .slice(0, input.limit)
        .map(({ score: _score, ...rest }) => rest);

      const nextCursor = scenarios.length > input.limit ? items[items.length - 1]?.id : undefined;

      // Cache first page
      if (!input.cursor && redis) {
        void setCachedTrendingFeed(
          { limit: input.limit, ...(input.cursor ? { cursor: input.cursor } : {}) },
          { items, nextCursor },
        );
      }

      return { items, nextCursor };
    }),

  getById: publicProcedure
    .use(withIPRateLimit({ limit: 120, window: 60 }))
    .input(z.object({ id: z.string().min(1, "Identifiant requis") }))
    .query(async ({ input, ctx }) => {
      // Single query with permissions baked into the WHERE clause.
      // Unlike the previous implementation (findUnique + post-filter), this
      // ensures that non-existent IDs and unauthorized scenarios return the
      // same response path and timing, preventing scenario enumeration via
      // timing side-channels.
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role;

      // Build permission conditions based on user authentication and role
      const permissionConditions: Array<Record<string, unknown>> = [
        // PUBLIC + APPROVED — anyone can see
        { visibility: "PUBLIC", moderationStatus: "APPROVED" },
      ];

      // Creator can always see their own scenarios regardless of visibility/moderation
      if (userId) {
        permissionConditions.push({
          creatorId: userId,
        });
      }

      // Staff (ADMIN, MODERATOR) can see all scenarios
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

  update: protectedProcedure
    .use(withREDMetrics)
    .use(withRateLimit({ limit: 30, window: 3600 }))
    .input(
      z
        .object({
          id: z.string().min(1, "Identifiant requis"),
          title: z
            .string()
            .min(3, "Minimum 3 caractères")
            .max(80, "Maximum 80 caractères")
            .optional(),
          description: z.string().max(300, "Maximum 300 caractères").optional(),
          openingMessage: z.string().max(300, "Maximum 300 caractères").optional(),
          aiInstructions: z.string().max(3000, "Maximum 3000 caractères").optional(),
          visibility: z
            .enum(["PRIVATE", "UNLISTED", "PUBLIC"], { message: "Visibilité invalide" })
            .optional(),
        })
        .refine(
          (data) =>
            Object.keys(data).some((k) => k !== "id" && data[k as keyof typeof data] !== undefined),
          { message: "Au moins un champ doit être fourni" },
        ),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.scenario.findUnique({
        where: { id: input.id },
      });
      if (!existing)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scénario introuvable",
        });
      if (existing.creatorId !== ctx.session.user.id)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'êtes pas le créateur de ce scénario",
        });

      const contentFields = ["title", "description", "openingMessage", "aiInstructions"] as const;
      const contentChanged = contentFields.some(
        (f) => input[f] !== undefined && input[f] !== existing[f],
      );

      const updateData: Prisma.ScenarioUpdateInput = {};
      if (input.title !== undefined) updateData.title = sanitizeUserText(input.title);
      if (input.description !== undefined) updateData.description = sanitizeUserText(input.description);
      if (input.openingMessage !== undefined) updateData.openingMessage = sanitizeUserText(input.openingMessage);
      if (input.aiInstructions !== undefined) updateData.aiInstructions = sanitizeUserText(input.aiInstructions);
      if (input.visibility !== undefined) updateData.visibility = input.visibility;

      if (contentChanged) {
        // XSS hardening: sanitize the changed text before blocklist + async moderation.
        const changedText = contentFields
          .filter((f) => input[f] !== undefined)
          .map((f) => sanitizeUserText(input[f] as string))
          .join(" ");
        const moderation = checkContentBlocklist(changedText);
        if (!moderation.approved)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: moderation.reason ?? "Contenu refusé",
          });
        updateData.moderationStatus = "PENDING";
      }

      await db.scenario.update({
        where: { id: input.id },
        data: updateData,
      });

      void invalidateFeedCache();

      // Schedule async AI moderation if content changed
      if (contentChanged) {
        const changedText = contentFields
          .filter((f) => input[f] !== undefined)
          .map((f) => input[f] as string)
          .join(" ");
        void scheduleAsyncModeration(changedText, { type: "scenario", id: input.id });
      }

      return { scenarioId: input.id };
    }),

  delete: protectedProcedure
    .use(withREDMetrics)
    .use(withRateLimit({ limit: 10, window: 3600 }))
    .input(z.object({ id: z.string().min(1, "Identifiant requis") }))
    .mutation(async ({ input, ctx }) => {
      const scenario = await db.scenario.findUnique({
        where: { id: input.id },
      });
      if (!scenario)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scénario introuvable",
        });
      if (scenario.creatorId !== ctx.session.user.id)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'êtes pas le créateur",
        });
      await db.scenario.delete({ where: { id: input.id } });
      void invalidateFeedCache();
      return { success: true };
    }),

  myScenarios: protectedProcedure
    .use(withIPRateLimit({ limit: 60, window: 60 }))
    .input(
      z.object({
        cursor: z.string().min(1, "Curseur invalide").optional(),
        limit: z.number().int().min(1, "Minimum 1").max(20, "Maximum 20").default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const scenarios = await db.scenario.findMany({
        where: { creatorId: ctx.session.user.id },
        take: input.limit + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          character: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatarUrl: true,
              category: true,
            },
          },
          _count: { select: { reactions: true, comments: true } },
        },
      });
      const items = scenarios.slice(0, input.limit);
      const nextCursor = scenarios.length > input.limit ? items[items.length - 1]?.id : undefined;
      return { items, nextCursor };
    }),
});
