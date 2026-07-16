import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MIN_REPORT_REASON_LENGTH } from "@/lib/constants";
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
import { detectCommentSpam } from "../services/security/spamDetection";
import { sanitizeUserContent } from "@/server/lib/sanitize";

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
      // Sanitize user-generated content before any storage/processing to
      // prevent stored XSS from raw <script>/event-handler payloads.
      const safeContent = sanitizeUserContent(input.content);

      // Spam detection (runs on the sanitized content)
      const spamCheck = await detectCommentSpam(ctx.session.user.id, safeContent);
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
          content: safeContent,
          moderationStatus: "PENDING",
        },
        include: {
          user: {
            select: { id: true, username: true, image: true },
          },
        },
      });

      // Schedule async AI moderation (fire-and-forget)
      void scheduleAsyncModeration(safeContent, { type: "comment", id: comment.id });

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
      const nextCursor = comments.length > input.limit ? items[items.length - 1]?.id : undefined;

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
      // Sanitize the user-supplied report reason before storage (prevents XSS).
      const safeReason = sanitizeUserContent(input.reason);

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
          reason: safeReason,
        },
      });

      return { reportId: report.id };
    }),
});
