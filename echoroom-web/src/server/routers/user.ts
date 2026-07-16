import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { anonymizePersonalData } from "@/server/services/user/anonymization";
import { db } from "../db";
import { protectedProcedure, router, withRateLimit } from "../procedures";
export const userRouter = router({
  badges: protectedProcedure.query(async ({ ctx }) => {
    const { db } = await import("@/server/db");
    const userBadges = await db.userBadge.findMany({
      where: { userId: ctx.session.user.id },
      include: { badge: true },
      orderBy: { awardedAt: "desc" },
    });
    return userBadges.map((ub) => ({
      id: ub.id,
      badge: ub.badge,
      awardedAt: ub.awardedAt,
    }));
  }),

  myDeletionStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        deletedAt: true,
        anonymizedAt: true,
        gdprDataExportedAt: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur introuvable",
      });
    }

    return user;
  }),

  withdrawConsent: protectedProcedure
    .use(withRateLimit({ limit: 2, window: 3600 }))
    .input(
      z.object({
        confirmation: z.literal("RETIRER"),
      }),
    )
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      // Atomic: active call check + already-withdrawn check + anonymization
      // live inside a single $transaction to eliminate TOCTOU window
      // between the guards and the mutation.
      await db.$transaction(async (tx) => {
        // Guard 1: Check for active call inside the transaction
        const activeCall = await tx.call.findFirst({
          where: {
            userId,
            status: { in: ["PENDING", "RINGING", "ACTIVE", "CALLING"] },
          },
          select: { id: true },
        });
        if (activeCall) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Impossible de retirer le consentement pendant un appel actif. Veuillez terminer l'appel d'abord.",
          });
        }

        // Guard 2: Check if consent already withdrawn (inside transaction for atomicity)
        const currentUser = await tx.user.findUnique({
          where: { id: userId },
          select: { consentWithdrawnAt: true },
        });
        if (currentUser?.consentWithdrawnAt) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Le consentement a déjà été retiré.",
          });
        }

        // Reversible withdrawal: preserve the original email/username so the
        // user can still authenticate and later re-consent. We only flag the
        // withdrawal (consentWithdrawnAt + consentWithdrawn) instead of
        // anonymizing the identity, which previously made re-consent impossible.
        await tx.user.update({
          where: { id: userId },
          data: {
            consentWithdrawnAt: new Date(),
            consentWithdrawn: true,
            tokenVersion: { increment: 1 },
          },
        });

        await anonymizePersonalData(tx, userId);

        await tx.auditLog.create({
          data: {
            action: "WITHDRAW_CONSENT",
            entityType: "User",
            entityId: userId,
            adminId: userId,
            metadata: { timestamp: new Date().toISOString() },
          },
        });
      });

      return { success: true };
    }),

  reconsent: protectedProcedure
    .input(z.object({ consentAccepted: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { consentWithdrawnAt: true },
      });
      if (!user?.consentWithdrawnAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Le consentement n'a pas été retiré.",
        });
      }
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            consentWithdrawnAt: null,
            consentWithdrawn: false,
            tokenVersion: { increment: 1 },
          },
        });
        await tx.auditLog.create({
          data: {
            action: "RECONSENT",
            entityType: "User",
            entityId: userId,
            adminId: userId,
            metadata: { timestamp: new Date().toISOString() },
          },
        });
      });
      return { success: true };
    }),

  getConsentStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: {
          consentWithdrawnAt: true,
          consentWithdrawn: true,
          consentAcceptedAt: true,
        },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" });
      }
      return {
        consentWithdrawnAt: user.consentWithdrawnAt,
        consentWithdrawn: user.consentWithdrawn,
        consentAcceptedAt: user.consentAcceptedAt,
        isConsentWithdrawn: user.consentWithdrawnAt !== null,
      };
    }),
});
