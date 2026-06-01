import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, withIPRateLimit, withRateLimit, withContentModeration } from "../trpc";
import { withREDMetrics } from "../middleware/metrics";
import { db } from "../db";
import { createClip, deleteClip, getClips } from "../services/social/clips";

export const clipsRouter = router({
  /**
   * List all clips for a given call.
   * The caller must own the call.
   */
  listByCall: protectedProcedure
    .use(withIPRateLimit({ limit: 60, window: 60 }))
    .input(z.object({ callId: z.string().min(1, "Identifiant d'appel requis") }))
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

  /**
   * List the current user's clips with cursor-based pagination.
   */
  listByUser: protectedProcedure
    .use(withIPRateLimit({ limit: 60, window: 60 }))
    .input(
      z.object({
        cursor: z.string().min(1, "Curseur invalide").optional(),
        limit: z.number().int().min(1, "Minimum 1").max(20, "Maximum 20").default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const clips = await db.clip.findMany({
        where: { userId: ctx.session.user.id },
        take: input.limit + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          call: {
            select: {
              scenario: { select: { id: true, title: true } },
            },
          },
        },
      });

      const items = clips.slice(0, input.limit);
      const nextCursor =
        clips.length > input.limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  /**
   * Create a new clip (DB record + background extraction).
   */
  create: protectedProcedure
    .use(withREDMetrics)
    .use(withContentModeration)
    .use(withRateLimit({ limit: 20, window: 3600 }))
    .input(
      z
        .object({
          callId: z.string().min(1, "Identifiant d'appel requis"),
          startTime: z.number().int().min(0, "Minimum 0").max(86400, "Maximum 86400"),
          endTime: z.number().int().min(0, "Minimum 0").max(86400, "Maximum 86400"),
          title: z.string().min(1, "Titre requis").max(100, "Maximum 100 caractères").optional(),
        })
        .refine((data) => data.endTime > data.startTime, {
          message: "La fin du clip doit être après le début",
        }),
    )
    .mutation(async ({ input, ctx }) => {
      return createClip({
        callId: input.callId,
        userId: ctx.session.user.id,
        startTime: input.startTime,
        endTime: input.endTime,
        title: input.title,
      });
    }),

  /**
   * Delete a clip owned by the current user.
   */
  delete: protectedProcedure
    .use(withRateLimit({ limit: 10, window: 3600 }))
    .input(z.object({ clipId: z.string().min(1, "Identifiant de clip requis") }))
    .mutation(async ({ input, ctx }) => {
      return deleteClip(input.clipId, ctx.session.user.id);
    }),
});
