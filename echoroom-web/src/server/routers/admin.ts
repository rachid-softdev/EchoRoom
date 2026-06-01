import { createHmac, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "@/lib/env";
import { anonymizePersonalData } from "@/server/services/user/anonymization";
import { purgeAnonymizedUsers } from "../jobs/gdprPurge";
import { db } from "../db";
import { getUTCDateString } from "../lib/date";
import { adminProcedure, router } from "../trpc";

function hashPhoneForAudit(phone: string): string {
  // HMAC avec AUDIT_HASH_SECRET comme sel pour empêcher les rainbow tables
  const hash = createHmac("sha256", env.AUDIT_HASH_SECRET).update(phone).digest("hex");
  return `blocked-${hash.substring(0, 16)}`;
}

export const adminRouter = router({
  featureScenario: adminProcedure
    .input(z.object({ scenarioId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const scenario = await db.scenario.findUnique({
        where: { id: input.scenarioId },
      });

      if (!scenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scénario introuvable",
        });
      }

      const today = getUTCDateString();
      await db.featuredScenario.upsert({
        where: { featuredDate: today },
        update: {
          scenarioId: input.scenarioId,
          featuredAt: new Date(),
          featureType: "ADMIN_CURATED",
        },
        create: {
          scenarioId: input.scenarioId,
          featuredDate: today,
          featuredAt: new Date(),
          featureType: "ADMIN_CURATED",
        },
      });

      await db.auditLog.create({
        data: {
          action: "FEATURE_SCENARIO",
          entityType: "Scenario",
          entityId: input.scenarioId,
          adminId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),

  removeFeatured: adminProcedure
    .input(z.object({ scenarioId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const today = getUTCDateString();
      await db.featuredScenario.deleteMany({
        where: { scenarioId: input.scenarioId, featuredDate: today },
      });

      await db.auditLog.create({
        data: {
          action: "REMOVE_FEATURED",
          entityType: "Scenario",
          entityId: input.scenarioId,
          adminId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),

  getFeaturedScenario: adminProcedure.query(async () => {
    const today = getUTCDateString();
    const featured = await db.featuredScenario.findUnique({
      where: { featuredDate: today },
      include: {
        scenario: {
          select: {
            id: true,
            title: true,
            description: true,
            playCount: true,
            likeCount: true,
            character: {
              select: { name: true, avatarUrl: true },
            },
            creator: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    return featured;
  }),

  moderationQueue: adminProcedure
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.number().min(1).max(50).default(20),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const scenarios = await db.scenario.findMany({
        where: { moderationStatus: "PENDING" },
        take: (input?.limit ?? 20) + 1,
        ...(input?.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "asc" },
        include: {
          creator: {
            select: { id: true, username: true },
          },
          character: {
            select: { name: true },
          },
        },
      });

      const limit = input?.limit ?? 20;
      const items = scenarios.slice(0, limit);
      const nextCursor = scenarios.length > limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  approveScenario: adminProcedure
    .input(z.object({ scenarioId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const scenario = await db.scenario.findUnique({
        where: { id: input.scenarioId },
      });

      if (!scenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scénario introuvable",
        });
      }

      await db.scenario.update({
        where: { id: input.scenarioId },
        data: { moderationStatus: "APPROVED" },
      });

      await db.auditLog.create({
        data: {
          action: "APPROVE_SCENARIO",
          entityType: "Scenario",
          entityId: input.scenarioId,
          adminId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),

  rejectScenario: adminProcedure
    .input(z.object({ scenarioId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const scenario = await db.scenario.findUnique({
        where: { id: input.scenarioId },
      });

      if (!scenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scénario introuvable",
        });
      }

      await db.scenario.update({
        where: { id: input.scenarioId },
        data: { moderationStatus: "REJECTED" },
      });

      await db.auditLog.create({
        data: {
          action: "REJECT_SCENARIO",
          entityType: "Scenario",
          entityId: input.scenarioId,
          adminId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),

  getAuditLogs: adminProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        action: z.string().optional(),
        entityType: z.string().optional(),
        adminId: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      }),
    )
    .query(async ({ input }) => {
      // Construire un filtre typé via Zod + Prisma.AuditLogWhereInput
      const where: Prisma.AuditLogWhereInput = {};
      if (input.action) where.action = { equals: input.action };
      if (input.entityType) where.entityType = { equals: input.entityType };
      if (input.adminId) where.adminId = input.adminId;
      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) where.createdAt.gte = new Date(input.startDate);
        if (input.endDate) where.createdAt.lte = new Date(input.endDate);
      }

      const logs = await db.auditLog.findMany({
        where,
        take: input.limit + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          admin: { select: { id: true, username: true } },
        },
      });

      const items = logs.slice(0, input.limit);
      const nextCursor = logs.length > input.limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  moderateComment: adminProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const comment = await db.comment.findUnique({
        where: { id: input.commentId },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Commentaire introuvable",
        });
      }

      await db.comment.update({
        where: { id: input.commentId },
        data: {
          moderationStatus: "REJECTED",
          moderatedById: ctx.session.user.id,
          moderatedAt: new Date(),
        },
      });

      await db.auditLog.create({
        data: {
          action: "MODERATE_COMMENT",
          entityType: "Comment",
          entityId: input.commentId,
          adminId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),

  approveComment: adminProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const comment = await db.comment.findUnique({
        where: { id: input.commentId },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Commentaire introuvable",
        });
      }

      await db.comment.update({
        where: { id: input.commentId },
        data: {
          moderationStatus: "APPROVED",
          moderatedById: ctx.session.user.id,
          moderatedAt: new Date(),
        },
      });

      await db.auditLog.create({
        data: {
          action: "APPROVE_COMMENT",
          entityType: "Comment",
          entityId: input.commentId,
          adminId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),

  getAbuseReports: adminProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        status: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const where: Prisma.AbuseReportWhereInput = {};
      if (input.status) where.status = { equals: input.status };

      const reports = await db.abuseReport.findMany({
        where,
        take: input.limit + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          reporter: { select: { id: true, username: true } },
          reviewedBy: { select: { id: true, username: true } },
        },
      });

      const items = reports.slice(0, input.limit);
      const nextCursor = reports.length > input.limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  dismissAbuseReport: adminProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const report = await db.abuseReport.findUnique({
        where: { id: input.reportId },
      });

      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Signalement introuvable",
        });
      }

      await db.abuseReport.update({
        where: { id: input.reportId },
        data: {
          status: "DISMISSED",
          reviewedById: ctx.session.user.id,
          reviewedAt: new Date(),
        },
      });

      await db.auditLog.create({
        data: {
          action: "DISMISS_ABUSE_REPORT",
          entityType: "AbuseReport",
          entityId: input.reportId,
          adminId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),

  getBlockedNumbers: adminProcedure.query(async () => {
    const blocked = await db.blockedNumber.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        blockedBy: { select: { id: true, username: true } },
      },
    });

    return { items: blocked };
  }),

  blockNumber: adminProcedure
    .input(
      z.object({
        phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/, "Format international requis"),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.blockedNumber.findUnique({
        where: { phoneNumber: input.phoneNumber },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ce numéro est déjà bloqué",
        });
      }

      const blocked = await db.blockedNumber.create({
        data: {
          phoneNumber: input.phoneNumber,
          reason: input.reason,
          blockedById: ctx.session.user.id,
        },
      });

      await db.auditLog.create({
        data: {
          action: "BLOCK_NUMBER",
          entityType: "BlockedNumber",
          entityId: blocked.id,
          adminId: ctx.session.user.id,
          metadata: { phoneNumber: hashPhoneForAudit(input.phoneNumber) },
        },
      });

      return { success: true, id: blocked.id };
    }),

  unblockNumber: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const blocked = await db.blockedNumber.findUnique({
        where: { id: input.id },
      });

      if (!blocked) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entrée introuvable",
        });
      }

      await db.blockedNumber.delete({
        where: { id: input.id },
      });

      await db.auditLog.create({
        data: {
          action: "UNBLOCK_NUMBER",
          entityType: "BlockedNumber",
          entityId: input.id,
          adminId: ctx.session.user.id,
          metadata: { phoneNumber: hashPhoneForAudit(blocked.phoneNumber) },
        },
      });

      return { success: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const anonId = randomUUID();
      // Generate a valid bcrypt hash of a random UUID as the sentinel password.
      const deletedHash = await bcrypt.hash(randomUUID(), 12);

      await db.$transaction(async (tx) => {
        const result = await tx.user.updateMany({
          where: { id: input.userId, deletedAt: null },
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

        if (result.count === 0) {
          // User either doesn't exist or is already deleted
          throw new TRPCError({
            code: "CONFLICT",
            message: "Utilisateur introuvable ou déjà supprimé",
          });
        }

        await anonymizePersonalData(tx, input.userId);
      });

      await db.auditLog.create({
        data: {
          action: "DELETE_USER",
          entityType: "User",
          entityId: input.userId,
          adminId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),

  getUserDetail: adminProcedure.input(z.object({ userId: z.string() })).query(async ({ input }) => {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        consentAcceptedAt: true,
        deletedAt: true,
        createdAt: true,
        // Legacy fields
        displayName: true,
        credits: true,
        totalLikesReceived: true,
        totalCallsMade: true,
        // Sub-aggregates
        profile: { select: { displayName: true, image: true, bio: true } },
        billing: { select: { credits: true } },
        social: { select: { totalLikesReceived: true, totalCallsMade: true } },
        _count: {
          select: {
            scenarios: true,
            calls: true,
            comments: true,
            reactions: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur introuvable",
      });
    }

    // Merge sub-aggregate values with legacy fields for the frontend
    return {
      ...user,
      displayName: user.profile?.displayName ?? user.displayName ?? null,
      credits: user.billing?.credits ?? user.credits,
      totalLikesReceived: user.social?.totalLikesReceived ?? user.totalLikesReceived,
      totalCallsMade: user.social?.totalCallsMade ?? user.totalCallsMade,
    };
  }),

  listUsers: adminProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        search: z.string().max(100).min(2).optional(),
      }),
    )
    .query(async ({ input }) => {
      const where: Prisma.UserWhereInput = {};
      if (input.search) {
        where.OR = [
          { username: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const users = await db.user.findMany({
        where,
        take: input.limit + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          deletedAt: true,
          createdAt: true,
          // Legacy fields
          credits: true,
          totalCallsMade: true,
          // Sub-aggregates
          billing: { select: { credits: true } },
          social: { select: { totalCallsMade: true } },
          _count: {
            select: {
              scenarios: true,
              calls: true,
            },
          },
        },
      });

      const items = users.slice(0, input.limit).map((u) => ({
        ...u,
        credits: u.billing?.credits ?? u.credits,
        totalCallsMade: u.social?.totalCallsMade ?? u.totalCallsMade,
      }));
      const nextCursor = users.length > input.limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  purgeGDPR: adminProcedure
    .input(z.object({
      retentionDays: z.number().min(7).max(90).default(30),
    }))
    .mutation(async ({ input }) => {
      const result = await purgeAnonymizedUsers(input.retentionDays);
      return result;
    }),
});
