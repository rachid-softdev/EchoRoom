import { db } from "@/server/db";
import { scenarioRepository, userSocialRepository } from "@/server/repositories";

export type Period = "ALL" | "WEEK" | "MONTH";
export type ScenarioSort = "LIKES" | "PLAYS";
export type CreatorSort = "LIKES" | "CALLS";

function getPeriodDate(period: Period): Date | null {
  if (period === "ALL") return null;
  const now = new Date();
  const days = period === "WEEK" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

interface GetTopScenariosParams {
  period: Period;
  sort: ScenarioSort;
}

interface GetTopCreatorsParams {
  period: Period;
  sort: CreatorSort;
}

export async function getTopScenarios(params: GetTopScenariosParams) {
  const sinceDate = getPeriodDate(params.period);
  return scenarioRepository.findTopByEngagement(params.sort, sinceDate, 20);
}

export async function getTopCreators(params: GetTopCreatorsParams) {
  const sinceDate = getPeriodDate(params.period);

  // For "ALL" period, use the UserSocial sub-aggregate for efficient sorting
  if (!sinceDate) {
    // Fetch top users from the sub-aggregate repository
    const topSocials =
      params.sort === "LIKES"
        ? await userSocialRepository.getTopByLikes(20)
        : await userSocialRepository.getTopByCalls(20);

    const userIds = topSocials.map((s) => s.userId);

    if (userIds.length === 0) return [];

    // Fetch user details in batch
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        image: true,
        _count: { select: { scenarios: true } },
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return topSocials.map((s) => {
      const user = userMap.get(s.userId);
      return {
        id: s.userId,
        username: user?.username ?? "utilisateur supprimé",
        image: user?.image ?? null,
        totalLikesReceived:
          "totalLikesReceived" in s ? (s as { totalLikesReceived: number }).totalLikesReceived : 0,
        totalCallsMade:
          "totalCallsMade" in s ? (s as { totalCallsMade: number }).totalCallsMade : 0,
        _count: { scenarios: user?._count?.scenarios ?? 0 },
      };
    });
  }

  // With period filter: approximate by finding users active during the period
  const where: import("@prisma/client").Prisma.UserWhereInput = {
    scenarios: {
      some: { createdAt: { gte: sinceDate } },
    },
  };

  // Fetch users with social stats — prefer UserSocial sub-aggregate,
  // fall back to legacy User fields.
  const users = await db.user.findMany({
    where,
    take: 20,
    select: {
      id: true,
      username: true,
      image: true,
      totalLikesReceived: true,
      totalCallsMade: true,
      social: {
        select: {
          totalLikesReceived: true,
          totalCallsMade: true,
        },
      },
      _count: {
        select: { scenarios: true },
      },
    },
  });

  // Sort by the requested metric using the sub-aggregate when available
  const sorted = users.sort((a, b) => {
    const aVal =
      params.sort === "LIKES"
        ? (a.social?.totalLikesReceived ?? a.totalLikesReceived)
        : (a.social?.totalCallsMade ?? a.totalCallsMade);
    const bVal =
      params.sort === "LIKES"
        ? (b.social?.totalLikesReceived ?? b.totalLikesReceived)
        : (b.social?.totalCallsMade ?? b.totalCallsMade);
    return bVal - aVal;
  });

  return sorted.map((u) => ({
    id: u.id,
    username: u.username,
    image: u.image,
    totalLikesReceived: u.social?.totalLikesReceived ?? u.totalLikesReceived,
    totalCallsMade: u.social?.totalCallsMade ?? u.totalCallsMade,
    _count: u._count,
  }));
}
