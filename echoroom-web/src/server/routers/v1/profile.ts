/**
 * v1 Profile Router — frozen API contract.
 *
 * @deprecated Use the unversioned `profileRouter` router instead.
 *
 * This router is a snapshot of the profile router at the time of versioning.
 * It maintains backward compatibility for clients that depend on the v1 shapes.
 * Changes and improvements should go into v2+ routers.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import {
  router,
  protectedProcedure,
  withRateLimit,
} from "../../procedures";
import { db } from "../../db";
import { decryptPhoneNumber, maskPhoneNumber } from "@/server/lib/encryption";
import { anonymizePersonalData } from "@/server/services/user/anonymization";

export const profileV1Router = router({
  me: protectedProcedure
    .use(withRateLimit({ limit: 120, window: 60 }))
    .query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        image: true,
        credits: true, // Legacy field
        billing: {
          select: { credits: true },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur introuvable",
      });
    }

    // Use UserBilling credits if available, fall back to legacy
    const credits = user.billing?.credits ?? user.credits;
    return { ...user, credits };
  }),

  updateProfile: protectedProcedure
    .use(withRateLimit({ limit: 10, window: 3600 }))
    .input(
      z.object({
        username: z.string().min(3).max(30),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            username: input.username,
          },
        });
        await tx.userProfile.upsert({
          where: { userId },
          create: { userId, displayName: input.username },
          update: { displayName: input.username },
        });
      });
      return { success: true };
    }),

  exportData: protectedProcedure
    .use(withRateLimit({ limit: 2, window: 3600 }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          consentAcceptedAt: true,
          gdprDataExportedAt: true,
          deletedAt: true,
          anonymizedAt: true,
          createdAt: true,
          // Sub-aggregates
          profile: { select: { image: true, displayName: true, bio: true } },
          social: { select: { totalLikesReceived: true, totalCallsMade: true } },
          billing: { select: { credits: true } },
          // Legacy fields (backward compat)
          image: true,
          displayName: true,
          bio: true,
          credits: true,
          totalLikesReceived: true,
          totalCallsMade: true,
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

      // Mask phone numbers: decrypt then show last 4 digits only
      const maskedCalls = calls.map((call) => {
        let masked = "****";
        try {
          const decrypted = decryptPhoneNumber(call.phoneNumber);
          masked = maskPhoneNumber(decrypted);
        } catch {
          // Legacy plaintext or decryption failure — fallback to simple masking
          if (call.phoneNumber.length >= 4) {
            masked = `xxxx${call.phoneNumber.slice(-4)}`;
          }
        }
        return { ...call, phoneNumber: masked };
      });

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
      const userId = ctx.session.user.id;
      const anonId = crypto.randomUUID();
      // Generate a valid bcrypt hash of a random UUID as the sentinel password.
      // crypto.randomUUID() alone would crash bcrypt.compare() in auth.ts
      // because UUIDs don't match the $2b$ format that bcrypt expects.
      const deletedHash = await bcrypt.hash(crypto.randomUUID(), 12);

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            deletedAt: new Date(),
            anonymizedAt: new Date(),
            email: `deleted-${anonId}@anonymized.echoroom.app`,
            username: `utilisateur-${anonId.substring(0, 8)}`,
            passwordHash: deletedHash,
            displayName: null,
            bio: null,
            image: null,
            tokenVersion: { increment: 1 },
          },
        });

        await anonymizePersonalData(tx, userId);
      });

      return { success: true };
    }),
});
