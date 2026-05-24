import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import {
  router,
  publicProcedure,
  protectedProcedure,
  withRateLimit,
  withContentModeration,
  withIPRateLimit,
} from "../trpc";
import { db } from "../db";
import { checkContent } from "../services/ai/moderation";

export const scenariosRouter = router({
  create: protectedProcedure
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
          creatorId: ctx.session!.user.id,
        },
      });

      return { scenarioId: scenario.id };
    }),

  feed: publicProcedure
    .use(withIPRateLimit({ limit: 60, window: 60 }))
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(20).default(10),
        sort: z.enum(["CHRONOLOGICAL", "TRENDING", "TOP"]).default("CHRONOLOGICAL"),
      }),
    )
    .query(async ({ input }) => {
      const orderBy =
        input.sort === "TOP" ? { likeCount: "desc" as const } : { createdAt: "desc" as const };

      const scenarios = await db.scenario.findMany({
        where: {
          visibility: "PUBLIC",
          moderationStatus: "APPROVED",
        },
        take: input.limit + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy,
        include: {
          creator: {
            select: { id: true, username: true, image: true },
          },
          character: {
            select: { id: true, name: true, slug: true, avatarUrl: true },
          },
          _count: {
            select: { reactions: true, comments: true },
          },
        },
      });

      let items = scenarios.slice(0, input.limit);

      // For TRENDING, sort in-memory using a trending score
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

      return { items, nextCursor };
    }),

  getById: publicProcedure
    .use(withIPRateLimit({ limit: 120, window: 60 }))
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const scenario = await db.scenario.findUnique({
        where: { id: input.id },
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

      if (!scenario) return null;

      // Visibility guard
      if (
        scenario.visibility === "PRIVATE" ||
        scenario.visibility === "UNLISTED"
      ) {
        if (ctx.session?.user?.id !== scenario.creatorId) return null;
      }

      // Moderation guard
      if (
        scenario.moderationStatus === "PENDING" ||
        scenario.moderationStatus === "REJECTED"
      ) {
        const isCreator = ctx.session?.user?.id === scenario.creatorId;
        const isStaff =
          ctx.session?.user?.role === "ADMIN" ||
          ctx.session?.user?.role === "MODERATOR";
        if (!isCreator && !isStaff) return null;
      }

      return scenario;
    }),

  update: protectedProcedure
    .use(withRateLimit({ limit: 30, window: 3600 }))
    .input(
      z
        .object({
          id: z.string(),
          title: z.string().min(3).max(80).optional(),
          description: z.string().max(300).optional(),
          openingMessage: z.string().max(300).optional(),
          aiInstructions: z.string().max(3000).optional(),
          visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
        })
        .refine(
          (data) =>
            Object.keys(data).some(
              (k) =>
                k !== "id" && data[k as keyof typeof data] !== undefined,
            ),
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
      if (existing.creatorId !== ctx.session!.user.id)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'êtes pas le créateur de ce scénario",
        });

      const contentFields = [
        "title",
        "description",
        "openingMessage",
        "aiInstructions",
      ] as const;
      const contentChanged = contentFields.some(
        (f) => input[f] !== undefined && input[f] !== existing[f],
      );

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (key !== "id" && value !== undefined) updateData[key] = value;
      }

      if (contentChanged) {
        const changedText = contentFields
          .filter((f) => input[f] !== undefined)
          .map((f) => input[f] as string)
          .join(" ");
        const moderation = await checkContent(changedText);
        if (!moderation.approved)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: moderation.reason ?? "Contenu refusé",
          });
        updateData.moderationStatus = "PENDING";
      }

      await db.scenario.update({
        where: { id: input.id },
        data: updateData as Prisma.ScenarioUpdateInput,
      });
      return { scenarioId: input.id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
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
      return { success: true };
    }),

  myScenarios: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(20).default(10),
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
            },
          },
          _count: { select: { reactions: true, comments: true } },
        },
      });
      const items = scenarios.slice(0, input.limit);
      const nextCursor =
        scenarios.length > input.limit
          ? items[items.length - 1]?.id
          : undefined;
      return { items, nextCursor };
    }),
});
