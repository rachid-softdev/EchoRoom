import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";

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

  const orderBy: Prisma.ScenarioOrderByWithRelationInput =
    params.sort === "LIKES" ? { likeCount: "desc" } : { playCount: "desc" };

  const where: Prisma.ScenarioWhereInput = {
    visibility: "PUBLIC",
    moderationStatus: "APPROVED",
  };

  if (sinceDate) {
    where.createdAt = { gte: sinceDate };
  }

  return db.scenario.findMany({
    where,
    orderBy,
    take: 20,
    select: {
      id: true,
      title: true,
      description: true,
      likeCount: true,
      playCount: true,
      createdAt: true,
      character: {
        select: { name: true, avatarUrl: true },
      },
      creator: {
        select: { username: true },
      },
      _count: {
        select: { comments: true, reactions: true },
      },
    },
  });
}

export async function getTopCreators(params: GetTopCreatorsParams) {
  const orderBy =
    params.sort === "LIKES"
      ? { totalLikesReceived: "desc" as const }
      : { totalCallsMade: "desc" as const };

  return db.user.findMany({
    orderBy,
    take: 20,
    select: {
      id: true,
      username: true,
      image: true,
      totalLikesReceived: true,
      totalCallsMade: true,
      _count: {
        select: { scenarios: true },
      },
    },
  });
}
