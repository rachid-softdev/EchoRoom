import { db } from "@/server/db";

type BadgeCriteria = {
  type: string;
  threshold?: number;
};

async function countUserCalls(userId: string): Promise<number> {
  return db.call.count({
    where: { userId, status: "COMPLETED" },
  });
}

async function countUserScenarios(userId: string): Promise<number> {
  return db.scenario.count({
    where: { creatorId: userId },
  });
}

async function sumLikesReceived(userId: string): Promise<number> {
  const result = await db.scenario.aggregate({
    where: { creatorId: userId },
    _sum: { likeCount: true },
  });
  return result._sum.likeCount ?? 0;
}

const TRIGGER_TO_BADGE_TYPES: Record<string, string[]> = {
  FIRST_CALL: ["FIRST_CALL"],
  TEN_CALLS: ["TEN_CALLS"],
  HUNDRED_CALLS: ["HUNDRED_CALLS"],
  FIRST_SCENARIO: ["FIRST_SCENARIO"],
  TEN_SCENARIOS: ["TEN_SCENARIOS"],
  LIKE_RECEIVED: ["FIRST_LIKE_RECEIVED", "HUNDRED_LIKES_RECEIVED"],
};

type BadgeInfo = {
  id: string;
  name: string;
  description: string;
  iconUrl: string | null;
};

/**
 * Checks and awards badges based on a trigger event.
 * Returns the first newly awarded badge, or null if none were awarded.
 */
export async function checkAndAwardBadges(
  userId: string,
  triggerEvent: string,
): Promise<BadgeInfo | null> {
  const badgeTypes = TRIGGER_TO_BADGE_TYPES[triggerEvent];
  if (!badgeTypes || badgeTypes.length === 0) return null;

  const badges = await db.badge.findMany();

  const candidateBadges = badges.filter((badge) => {
    const criteria = badge.criteria as BadgeCriteria;
    return badgeTypes.includes(criteria.type);
  });

  for (const badge of candidateBadges) {
    const criteria = badge.criteria as BadgeCriteria;
    const threshold = criteria.threshold ?? 1;

    let meetsCriteria = false;

    switch (criteria.type) {
      case "FIRST_CALL":
      case "TEN_CALLS":
      case "HUNDRED_CALLS": {
        const count = await countUserCalls(userId);
        meetsCriteria = count >= threshold;
        break;
      }
      case "FIRST_SCENARIO":
      case "TEN_SCENARIOS": {
        const count = await countUserScenarios(userId);
        meetsCriteria = count >= threshold;
        break;
      }
      case "FIRST_LIKE_RECEIVED":
      case "HUNDRED_LIKES_RECEIVED": {
        const count = await sumLikesReceived(userId);
        meetsCriteria = count >= threshold;
        break;
      }
    }

    if (!meetsCriteria) continue;

    const existing = await db.userBadge.findUnique({
      where: {
        userId_badgeId: { userId, badgeId: badge.id },
      },
    });
    if (existing) continue;

    await db.userBadge.create({
      data: { userId, badgeId: badge.id },
    });

    return {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      iconUrl: badge.iconUrl,
    };
  }

  return null;
}
