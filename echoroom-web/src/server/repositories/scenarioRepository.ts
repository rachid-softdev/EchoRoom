import type { Prisma, PrismaClient, Scenario, Character } from "@prisma/client";

export interface IScenarioRepository {
  findById(id: string): Promise<Scenario | null>;
  findByIdWithCharacter(id: string): Promise<(Scenario & { character: Character }) | null>;
  incrementPlayCount(id: string): Promise<void>;
  create(data: Pick<Scenario, "creatorId" | "characterId" | "title" | "description" | "openingMessage" | "aiInstructions">): Promise<Scenario>;
  findTopByEngagement(
    sort: "LIKES" | "PLAYS",
    sinceDate: Date | null,
    limit: number,
  ): Promise<any[]>;
  countByCreator(userId: string): Promise<number>;
  sumLikesByCreator(userId: string): Promise<number>;
  updateModerationStatus(id: string, status: string): Promise<void>;
}

export class PrismaScenarioRepository implements IScenarioRepository {
  constructor(private db: PrismaClient) {}

  async findById(id: string): Promise<Scenario | null> {
    return this.db.scenario.findUnique({ where: { id } });
  }

  async findByIdWithCharacter(id: string): Promise<(Scenario & { character: Character }) | null> {
    return this.db.scenario.findUnique({
      where: { id },
      include: { character: true },
    }) as Promise<(Scenario & { character: Character }) | null>;
  }

  async incrementPlayCount(id: string): Promise<void> {
    await this.db.scenario.update({
      where: { id },
      data: { playCount: { increment: 1 } },
    });
  }

  async create(data: Pick<Scenario, "creatorId" | "characterId" | "title" | "description" | "openingMessage" | "aiInstructions">): Promise<Scenario> {
    return this.db.scenario.create({ data });
  }

  async findTopByEngagement(
    sort: "LIKES" | "PLAYS",
    sinceDate: Date | null,
    limit: number,
  ): Promise<any[]> {
    const orderBy =
      sort === "LIKES"
        ? ({ likeCount: "desc" } as const)
        : ({ playCount: "desc" } as const);

    const where: Prisma.ScenarioWhereInput = {
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
    };
    if (sinceDate) where.createdAt = { gte: sinceDate };

    return this.db.scenario.findMany({
      where,
      orderBy,
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        likeCount: true,
        playCount: true,
        createdAt: true,
        character: { select: { name: true, avatarUrl: true } },
        creator: { select: { username: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    });
  }

  async countByCreator(userId: string): Promise<number> {
    return this.db.scenario.count({ where: { creatorId: userId } });
  }

  async sumLikesByCreator(userId: string): Promise<number> {
    const result = await this.db.scenario.aggregate({
      where: { creatorId: userId },
      _sum: { likeCount: true },
    });
    return result._sum.likeCount ?? 0;
  }

  async updateModerationStatus(id: string, status: string): Promise<void> {
    await this.db.scenario.updateMany({
      where: { id },
      data: { moderationStatus: status },
    });
  }
}
