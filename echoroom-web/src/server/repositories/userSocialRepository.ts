import type { PrismaClient, UserSocial } from "@prisma/client";

export interface IUserSocialRepository {
  findByUserId(
    userId: string,
  ): Promise<Pick<UserSocial, "id" | "userId" | "totalLikesReceived" | "totalCallsMade"> | null>;
  upsert(
    userId: string,
    data?: Partial<Pick<UserSocial, "totalLikesReceived" | "totalCallsMade">>,
  ): Promise<UserSocial>;
  incrementLikesReceived(userId: string): Promise<void>;
  decrementLikesReceived(userId: string): Promise<void>;
  getTopByLikes(limit?: number): Promise<Array<Pick<UserSocial, "userId" | "totalLikesReceived">>>;
  getTopByCalls(limit?: number): Promise<Array<Pick<UserSocial, "userId" | "totalCallsMade">>>;
}

export class PrismaUserSocialRepository implements IUserSocialRepository {
  constructor(private db: PrismaClient) {}

  async findByUserId(
    userId: string,
  ): Promise<Pick<UserSocial, "id" | "userId" | "totalLikesReceived" | "totalCallsMade"> | null> {
    return this.db.userSocial.findUnique({
      where: { userId },
      select: { id: true, userId: true, totalLikesReceived: true, totalCallsMade: true },
    });
  }

  async upsert(
    userId: string,
    data?: Partial<Pick<UserSocial, "totalLikesReceived" | "totalCallsMade">>,
  ): Promise<UserSocial> {
    return this.db.userSocial.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data ?? {},
    });
  }

  async incrementLikesReceived(userId: string): Promise<void> {
    await this.db.userSocial.upsert({
      where: { userId },
      create: { userId, totalLikesReceived: 1 },
      update: { totalLikesReceived: { increment: 1 } },
    });
  }

  async decrementLikesReceived(userId: string): Promise<void> {
    await this.db.userSocial.upsert({
      where: { userId },
      create: { userId },
      update: { totalLikesReceived: { decrement: 1 } },
    });
  }

  async getTopByLikes(
    limit: number = 20,
  ): Promise<Array<Pick<UserSocial, "userId" | "totalLikesReceived">>> {
    return this.db.userSocial.findMany({
      orderBy: { totalLikesReceived: "desc" },
      take: limit,
      select: { userId: true, totalLikesReceived: true },
    });
  }

  async getTopByCalls(
    limit: number = 20,
  ): Promise<Array<Pick<UserSocial, "userId" | "totalCallsMade">>> {
    return this.db.userSocial.findMany({
      orderBy: { totalCallsMade: "desc" },
      take: limit,
      select: { userId: true, totalCallsMade: true },
    });
  }
}
