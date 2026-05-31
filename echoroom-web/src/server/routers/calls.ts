import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, withRateLimit } from "../trpc";
import { withREDMetrics } from "../middleware/metrics";
import { db } from "../db";
import { initiateCall } from "../services/telephony/callLifecycle";
import { getPresignedUrl } from "../services/audio/r2";
import { AppError } from "../lib/errors";
import { getUTCDayRange } from "../lib/date";

export const callsRouter = router({
  start: protectedProcedure
    .use(withREDMetrics)
    .input(
      z.object({
        scenarioId: z.string(),
        phoneNumber: z.string().transform((val) => val.normalize("NFKC"))
          .pipe(z.string().regex(
            /^\+[1-9]\d{6,14}$/,
            "Le numéro doit être au format international (ex: +33612345678)",
          )),
        maxDurationSeconds: z.number().int().min(60).max(3600).default(300),
      }),
    )
    .use(withRateLimit({ limit: 20, window: 3600 }))
    .mutation(async ({ input, ctx }) => {
      // Blacklist check
      const blocked = await db.blockedNumber.findUnique({
        where: { phoneNumber: input.phoneNumber },
      });
      if (blocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Ce numéro a été bloqué",
        });
      }

      try {
        const result = await initiateCall({
          scenarioId: input.scenarioId,
          userId: ctx.session.user.id,
          phoneNumber: input.phoneNumber,
          maxDurationSeconds: input.maxDurationSeconds,
        });

        // Increment scenario play count after successful initiation
        await db.scenario.update({
          where: { id: input.scenarioId },
          data: { playCount: { increment: 1 } },
        });

        return result;
      } catch (error) {
        if (error instanceof AppError) {
          switch (error.code) {
            case "SCENARIO_NOT_FOUND":
              throw new TRPCError({ code: "NOT_FOUND", message: "Scénario introuvable" });
            case "USER_NOT_FOUND":
              throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur introuvable" });
            case "INSUFFICIENT_CREDITS":
              throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Crédits insuffisants" });
            case "TWILIO_ERROR":
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Échec de l'appel" });
            case "DAILY_LIMIT_EXCEEDED":
              throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Limite quotidienne d'appels atteinte" });
            default:
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur inattendue" });
          }
        }
        throw error;
      }
    }),

  history: protectedProcedure
    .use(withREDMetrics)
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(20).default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const calls = await db.call.findMany({
        where: { userId: ctx.session.user.id },
        take: input.limit + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
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
      });

      const items = calls.slice(0, input.limit);
      const nextCursor =
        calls.length > input.limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  todayCount: protectedProcedure
    .query(async ({ ctx }) => {
      const { todayStart, todayEnd } = getUTCDayRange();
      const count = await db.call.count({
        where: {
          userId: ctx.session.user.id,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      });
      return { count };
    }),

  replay: protectedProcedure
    .input(z.object({ callId: z.string() }))
    .query(async ({ input, ctx }) => {
      const call = await db.call.findUnique({
        where: { id: input.callId },
      });

      if (!call) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appel introuvable",
        });
      }

      if (call.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cet appel ne vous appartient pas",
        });
      }

      const recordingUrl = call.recordingUrl
        ? await getPresignedUrl(call.recordingUrl)
        : null;

      return {
        recordingUrl,
        transcript: call.transcript as
          | Array<{ speaker: string; text: string; timestamp: number }>
          | null,
      };
    }),
});
