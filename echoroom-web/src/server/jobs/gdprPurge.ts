import { redis } from "@/lib/redis";
import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("gdpr-purge");
const BATCH_SIZE = 50;
const LOCK_KEY = "job:gdpr-purge:lock";
const LOCK_TTL_SECONDS = 300;

export async function purgeAnonymizedUsers(
  retentionDays: number = 30,
): Promise<{ deletedUsers: number }> {
  if (redis) {
    const lock = await redis.set(LOCK_KEY, "1", { nx: true, ex: LOCK_TTL_SECONDS });
    if (!lock) {
      log.warn("GDPR purge already running — skipping");
      return { deletedUsers: 0 };
    }
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    let totalDeleted = 0;
    let cursor: string | undefined;

    while (true) {
      const expiredUsers = await db.user.findMany({
        where: {
          deletedAt: { lte: cutoff, not: null },
          anonymizedAt: { not: null },
        },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        select: { id: true },
      });

      if (expiredUsers.length === 0) break;

      for (const user of expiredUsers) {
        await hardDeleteUser(user.id);
        totalDeleted++;
      }

      const lastItem = expiredUsers[expiredUsers.length - 1];
      if (!lastItem || expiredUsers.length < BATCH_SIZE) break;
      cursor = lastItem.id;
    }

    log.info("GDPR purge complete", { deletedUsers: totalDeleted, retentionDays });
    return { deletedUsers: totalDeleted };
  } finally {
    if (redis) {
      await redis.del(LOCK_KEY);
    }
  }
}

async function hardDeleteUser(userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    // Niveau 1: calls (cascade → clips)
    await tx.call.deleteMany({ where: { userId } });

    // Safety: sever scenario link from active calls by OTHER users before deleting creator's scenarios
    const activeScenarioCallCount = await tx.call.count({
      where: {
        scenario: { creatorId: userId },
        userId: { not: userId },
        status: { in: ["PENDING", "RINGING", "ACTIVE", "CALLING"] as any },
      },
    });
    if (activeScenarioCallCount > 0) {
      log.warn("Severing active calls from deleted user's scenarios", {
        userId,
        activeCallCount: activeScenarioCallCount,
      });
      await tx.call.updateMany({
        where: {
          scenario: { creatorId: userId },
          userId: { not: userId },
          status: { in: ["PENDING", "RINGING", "ACTIVE", "CALLING"] as any },
        },
        data: { scenarioId: null },
      });
    }

    // scenarios (cascade → reactions, comments, shareEvents, featuredEntries)
    await tx.scenario.deleteMany({ where: { creatorId: userId } });
    // Réactions et commentaires sur le contenu d'autrui
    await tx.reaction.deleteMany({ where: { userId } });
    await tx.comment.deleteMany({ where: { userId } });
    // Niveau 2: purchases, daily limits
    await tx.purchase.deleteMany({ where: { userId } });
    await tx.dailyCallLimit.deleteMany({ where: { userId } });
    // Niveau 3: modération et audit
    await tx.abuseReport.deleteMany({
      where: { OR: [{ reporterId: userId }, { reviewedById: userId }] },
    });
    await tx.auditLog.deleteMany({ where: { adminId: userId } });
    await tx.blockedNumber.deleteMany({ where: { blockedById: userId } });
    await tx.comment.updateMany({
      where: { moderatedById: userId },
      data: { moderatedById: null, moderatedAt: null },
    });
    // Niveau 4: social
    await tx.userBadge.deleteMany({ where: { userId } });
    await tx.clip.deleteMany({ where: { userId } });
    await tx.shareEvent.deleteMany({ where: { userId } });
    // Final
    await tx.user.delete({ where: { id: userId } });
  });
}
