import { badgeRepository } from "@/server/repositories";

type BadgeCriteria = {
  type: string;
  threshold?: number;
};

async function countUserCalls(userId: string): Promise<number> {
  return badgeRepository.countUserCallsByStatus(userId, "COMPLETED");
}

async function countUserScenarios(userId: string): Promise<number> {
  return badgeRepository.countUserScenarios(userId);
}

async function sumLikesReceived(userId: string): Promise<number> {
  return badgeRepository.sumLikesReceived(userId);
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

  // Prisma stores `criteria` as JSONB (PostgreSQL). Use `path` filter on the JSON field
  // to push filtering to the database instead of fetching all rows.
  // If your Prisma version doesn't support JSON `path` filtering, fall back to in-memory
  // filtering — the badge table is a small reference set (<50 rows), so the impact is minimal.
  const candidateBadges = await badgeRepository.findCandidateBadges(badgeTypes);

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

    const existing = await badgeRepository.findUserBadge(userId, badge.id);
    if (existing) continue;

    await badgeRepository.createUserBadge(userId, badge.id);

    return {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      iconUrl: badge.iconUrl,
    };
  }

  return null;
}
