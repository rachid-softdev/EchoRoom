import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { maskPhoneNumber } from "@/server/lib/encryption";
import { router, adminProcedure } from "../trpc";
import { db } from "../db";
import { getUTCDateString } from "../lib/date";

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
      }),
    )
    .query(async ({ input }) => {
      const where: Prisma.AuditLogWhereInput = {};
      if (input.action) where.action = { equals: input.action };
      if (input.entityType) where.entityType = { equals: input.entityType };

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
          metadata: { phoneNumber: maskPhoneNumber(input.phoneNumber) },
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
          metadata: { phoneNumber: maskPhoneNumber(blocked.phoneNumber) },
        },
      });

      return { success: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, deletedAt: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Utilisateur introuvable",
        });
      }

      if (user.deletedAt) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cet utilisateur est déjà supprimé",
        });
      }

      const anonId = crypto.randomUUID();

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: input.userId },
          data: {
            deletedAt: new Date(),
            anonymizedAt: new Date(),
            email: `deleted-${anonId}@anonymized.echoroom.app`,
            username: `utilisateur-${anonId.substring(0, 8)}`,
            passwordHash: crypto.randomUUID(),
            displayName: null,
            bio: null,
            image: null,
          },
        });

        const { anonymizePersonalData } = await import(
          "@/server/services/user/anonymization"
        );
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

  getUserDetail: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const user = await db.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          credits: true,
          totalLikesReceived: true,
          totalCallsMade: true,
          consentAcceptedAt: true,
          deletedAt: true,
          createdAt: true,
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

      return user;
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
          credits: true,
          totalCallsMade: true,
          deletedAt: true,
          createdAt: true,
          _count: {
            select: {
              scenarios: true,
              calls: true,
            },
          },
        },
      });

      const items = users.slice(0, input.limit);
      const nextCursor = users.length > input.limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),
});
