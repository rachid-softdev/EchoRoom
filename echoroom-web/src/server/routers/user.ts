import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, withRateLimit } from "../trpc";
import { db } from "../db";

export const userRouter = router({
  exportMyData: protectedProcedure
    .use(withRateLimit({ limit: 2, window: 3600 }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.session!.user.id;

      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          bio: true,
          image: true,
          role: true,
          credits: true,
          totalLikesReceived: true,
          totalCallsMade: true,
          consentAcceptedAt: true,
          gdprDataExportedAt: true,
          deletedAt: true,
          anonymizedAt: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Utilisateur introuvable",
        });
      }

      const scenarios = await db.scenario.findMany({
        where: { creatorId: userId },
        select: {
          id: true,
          title: true,
          description: true,
          visibility: true,
          moderationStatus: true,
          playCount: true,
          likeCount: true,
          createdAt: true,
          character: { select: { name: true } },
        },
      });

      const calls = await db.call.findMany({
        where: { userId },
        select: {
          id: true,
          phoneNumber: true,
          status: true,
          durationSeconds: true,
          costCredits: true,
          createdAt: true,
          endedAt: true,
        },
      });

      // Mask phone numbers: keep last 4 digits only
      const maskedCalls = calls.map((call) => ({
        ...call,
        phoneNumber: call.phoneNumber.length >= 4
          ? `xxxx${call.phoneNumber.slice(-4)}`
          : "xxxx",
      }));

      const comments = await db.comment.findMany({
        where: { userId },
        select: {
          id: true,
          content: true,
          moderationStatus: true,
          createdAt: true,
          scenario: { select: { id: true, title: true } },
        },
      });

      const purchases = await db.purchase.findMany({
        where: { userId },
        select: {
          id: true,
          creditsPurchased: true,
          stripePaymentId: true,
          createdAt: true,
        },
      });

      await db.user.update({
        where: { id: userId },
        data: { gdprDataExportedAt: new Date() },
      });

      return {
        exportedAt: new Date().toISOString(),
        user,
        scenarios,
        calls: maskedCalls,
        comments,
        purchases,
      };
    }),

  deleteMyAccount: protectedProcedure
    .use(withRateLimit({ limit: 1, window: 3600 }))
    .input(
      z.object({
        confirmation: z.literal("SUPPRIMER"),
      }),
    )
    .mutation(async ({ ctx }) => {
      const userId = ctx.session!.user.id;
      const shortId = userId.slice(0, 8);

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            deletedAt: new Date(),
            anonymizedAt: new Date(),
            email: `deleted-${userId}@anonymized.echoroom.app`,
            username: `utilisateur-${shortId}`,
            passwordHash: "DELETED",
            displayName: null,
            bio: null,
            image: null,
          },
        });

        await tx.scenario.updateMany({
          where: { creatorId: userId },
          data: { visibility: "PRIVATE" },
        });

        await tx.comment.updateMany({
          where: { userId },
          data: { content: "[Commentaire supprimé]" },
        });
      });

      return { success: true };
    }),

  myDeletionStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session!.user.id },
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
});
