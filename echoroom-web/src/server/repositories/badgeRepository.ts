import type { PrismaClient, Badge, UserBadge, $Enums } from "@prisma/client";

export interface IBadgeRepository {
  findCandidateBadges(badgeTypes: string[]): Promise<Badge[]>;
  findUserBadge(userId: string, badgeId: string): Promise<UserBadge | null>;
  createUserBadge(userId: string, badgeId: string): Promise<UserBadge>;
  countUserCallsByStatus(userId: string, status: string): Promise<number>;
  countUserScenarios(userId: string): Promise<number>;
  sumLikesReceived(userId: string): Promise<number>;
}

export class PrismaBadgeRepository implements IBadgeRepository {
  constructor(private db: PrismaClient) {}

  async findCandidateBadges(badgeTypes: string[]): Promise<Badge[]> {
    return this.db.badge.findMany({
      where: {
        OR: badgeTypes.map((type) => ({
          criteria: { path: ["type"], equals: type },
        })),
      },
    });
  }

  async findUserBadge(userId: string, badgeId: string): Promise<UserBadge | null> {
    return this.db.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    });
  }

  async createUserBadge(userId: string, badgeId: string): Promise<UserBadge> {
    return this.db.userBadge.create({ data: { userId, badgeId } });
  }

  async countUserCallsByStatus(userId: string, status: string): Promise<number> {
    return this.db.call.count({ where: { userId, status: status as $Enums.CallStatus } });
  }

  async countUserScenarios(userId: string): Promise<number> {
    return this.db.scenario.count({ where: { creatorId: userId } });
  }

  async sumLikesReceived(userId: string): Promise<number> {
    const result = await this.db.scenario.aggregate({
      where: { creatorId: userId },
      _sum: { likeCount: true },
    });
    return result._sum.likeCount ?? 0;
  }
}
