/**
 * v1 Calls Router — frozen API contract.
 *
 * @deprecated Use the unversioned `callsRouter` router instead.
 *
 * This router is a snapshot of the calls router at the time of versioning.
 * It maintains backward compatibility for clients that depend on the v1 shapes.
 * Changes and improvements should go into v2+ routers.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, withRateLimit } from "../../procedures";
import { withREDMetrics } from "../../middleware/metrics";
import { db } from "../../db";
import { initiateCall } from "../../services/telephony/callLifecycle";
import { getPresignedUrl } from "../../services/audio/r2";
import { AppError } from "../../lib/errors";
import { getUTCDayRange } from "../../lib/date";
import { redis } from "@/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { detectCallSpam } from "../../services/security/spamDetection";

const log = createLogger("calls-cache");

export const callsV1Router = router({
  start: protectedProcedure
    .use(withREDMetrics)
    .input(
      z.object({
        scenarioId: z.string().min(1, "Scénario requis"),
        phoneNumber: z.string().transform((val) => val.normalize("NFKC"))
          .pipe(z.string().regex(
            /^\+[1-9]\d{6,14}$/,
            "Le numéro doit être au format international (ex: +33612345678)",
          )),
        maxDurationSeconds: z.number().int().min(60, "Minimum 60 secondes").max(3600, "Maximum 3600 secondes").default(300),
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

      // Spam detection
      const spamCheck = await detectCallSpam(ctx.session.user.id, input.phoneNumber);
      if (spamCheck.flagged) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: spamCheck.reason ?? "Trop de requêtes",
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

        // Invalidate user's history cache
        if (redis) {
          try {
            const keys = await redis.keys(`cache:calls:history:${ctx.session.user.id}:*`);
            if (keys.length > 0) {
              await redis.del(...keys);
            }
          } catch (error) {
            log.warn("History cache invalidation failed", { error });
          }
        }

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
        limit: z.number().min(1, "Minimum 1").max(20, "Maximum 20").default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const cacheKey = `cache:calls:history:${ctx.session.user.id}:${input.cursor ?? "first"}:${input.limit}`;

      if (redis) {
        try {
          const cached = await redis.get<{ items: unknown[]; nextCursor: string | undefined }>(cacheKey);
          if (cached) return cached;
        } catch (error) {
          log.warn("History cache read failed", { error });
        }
      }

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

      const result = { items, nextCursor };

      if (redis) {
        try {
          await redis.set(cacheKey, JSON.stringify(result), { ex: 30 });
        } catch (error) {
          log.warn("History cache write failed", { error });
        }
      }

      return result;
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

  listByScenario: protectedProcedure
    .use(withREDMetrics)
    .input(
      z.object({
        scenarioId: z.string().min(1, "Scénario requis"),
        cursor: z.string().optional(),
        limit: z.number().int().min(1, "Minimum 1").max(20, "Maximum 20").default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const calls = await db.call.findMany({
        where: {
          userId: ctx.session.user.id,
          scenarioId: input.scenarioId,
          recordingUrl: { not: null },
        },
        take: input.limit + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          durationSeconds: true,
          createdAt: true,
          status: true,
        },
      });

      const items = calls.slice(0, input.limit);
      const nextCursor =
        calls.length > input.limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  replay: protectedProcedure
    .input(z.object({ callId: z.string().min(1, "Identifiant d'appel requis") }))
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
