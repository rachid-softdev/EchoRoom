import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  publicProcedure,
  protectedProcedure,
  withRateLimit,
  withContentModeration,
  withIPRateLimit,
} from "../procedures";
import { withREDMetrics } from "../middleware/metrics";
import { db } from "../db";
import { MIN_REPORT_REASON_LENGTH } from "@/lib/constants";
import { scheduleAsyncModeration } from "../services/ai/asyncModeration";
import { detectCommentSpam } from "../services/security/spamDetection";

export const communityRouter = router({
  comment: protectedProcedure
    .use(withREDMetrics)
    .use(withContentModeration)
    .use(withRateLimit({ limit: 30, window: 3600 }))
    .input(
      z.object({
        scenarioId: z.string().min(1, "Scénario requis"),
        content: z.string().min(1, "Contenu requis").max(500, "Maximum 500 caractères"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Spam detection
      const spamCheck = await detectCommentSpam(ctx.session.user.id, input.content);
      if (spamCheck.flagged) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: spamCheck.reason ?? "Trop de requêtes",
        });
      }

      const comment = await db.comment.create({
        data: {
          userId: ctx.session.user.id,
          scenarioId: input.scenarioId,
          content: input.content,
          moderationStatus: "PENDING",
        },
        include: {
          user: {
            select: { id: true, username: true, image: true },
          },
        },
      });

      // Schedule async AI moderation (fire-and-forget)
      void scheduleAsyncModeration(input.content, { type: "comment", id: comment.id });

      return comment;
    }),

  getComments: publicProcedure
    .use(withREDMetrics)
    .use(withIPRateLimit({ limit: 60, window: 60 }))
    .input(
      z.object({
        scenarioId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const comments = await db.comment.findMany({
        where: { scenarioId: input.scenarioId, moderationStatus: "APPROVED" },
        take: input.limit + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, username: true, image: true },
          },
        },
      });

      const items = comments.slice(0, input.limit);
      const nextCursor =
        comments.length > input.limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  reportAbuse: protectedProcedure
    .use(withREDMetrics)
    .use(withRateLimit({ limit: 10, window: 3600 }))
    .input(
      z.object({
        targetType: z.string().min(1).max(50),
        targetId: z.string().min(1),
        reason: z.string().min(MIN_REPORT_REASON_LENGTH).max(1000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.abuseReport.findFirst({
        where: {
          reporterId: ctx.session.user.id,
          targetType: input.targetType,
          targetId: input.targetId,
          status: "PENDING",
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Vous avez déjà signalé ce contenu",
        });
      }

      const report = await db.abuseReport.create({
        data: {
          reporterId: ctx.session.user.id,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
        },
      });

      return { reportId: report.id };
    }),
});
